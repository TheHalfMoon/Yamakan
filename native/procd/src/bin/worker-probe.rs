//! Dependency-free native stand-in for Windows sandbox tests.
//! Node.js is not a valid probe under the less-privileged AppContainer:
//! the Node runtime itself can terminate before the test payload begins.
//! The production worker is FFmpeg/ffprobe, not Node.
use std::{
    env, fs,
    net::{SocketAddr, TcpStream},
    process::{self, Command},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
fn hex(s: &str) -> String {
    s.as_bytes().iter().map(|b| format!("{b:02x}")).collect()
}
fn write(path: &str) -> bool {
    fs::write(path, b"x").is_ok()
}
fn read(path: &str) -> bool {
    fs::read(path).is_ok()
}
fn list(path: &str) -> bool {
    fs::read_dir(path).is_ok()
}
// AppContainer without network capabilities can return WSASYSNOTREADY from
// WSAStartup. Rust's TcpStream performs an assert on that condition, so
// probe it explicitly first and record denial rather than crashing the test.
#[cfg(windows)]
#[link(name = "ws2_32")]
extern "system" {
    fn WSAStartup(version: u16, data: *mut std::ffi::c_void) -> i32;
}
fn network_available() -> bool {
    #[cfg(windows)]
    {
        let mut data = [0u64; 128];
        unsafe { WSAStartup(0x202, data.as_mut_ptr() as *mut std::ffi::c_void) == 0 }
    }
    #[cfg(not(windows))]
    {
        true
    }
}
fn connect(ip: &str, port: u16) -> bool {
    if !network_available() {
        return false;
    }
    format!("{ip}:{port}")
        .parse::<SocketAddr>()
        .ok()
        .and_then(|addr| TcpStream::connect_timeout(&addr, Duration::from_millis(1000)).ok())
        .is_some()
}
fn child() -> bool {
    Command::new(format!(
        "{}\\System32\\cmd.exe",
        env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into())
    ))
    .args(["/c", "exit", "7"])
    .status()
    .is_ok()
}
// Starts n copies of this probe, each sleeping ms (the engine-worker
// profile's permitted descendants); returns how many started and their pids.
fn tree(n: usize, ms: &str) -> (usize, Vec<u32>) {
    let exe = env::current_exe().unwrap_or_default();
    let mut started = Vec::new();
    let mut pids = Vec::new();
    for _ in 0..n {
        if let Ok(c) = Command::new(&exe).args(["sleep-ms", ms]).spawn() {
            pids.push(c.id());
            started.push(c);
        }
    }
    let count = started.len();
    for mut c in started {
        let _ = c.wait();
    }
    (count, pids)
}
fn resolves(host: &str) -> bool {
    use std::net::ToSocketAddrs;
    network_available()
        && (host, 80)
            .to_socket_addrs()
            .map(|mut a| a.next().is_some())
            .unwrap_or(false)
}
fn arg(args: &[String], index: usize) -> &str {
    args.get(index).map(String::as_str).unwrap_or("")
}
#[cfg(windows)]
#[link(name = "advapi32")]
extern "system" {
    fn GetNamedSecurityInfoW(
        name: *const u16,
        kind: i32,
        info: u32,
        owner: *mut *mut std::ffi::c_void,
        group: *mut *mut std::ffi::c_void,
        dacl: *mut *mut std::ffi::c_void,
        sacl: *mut *mut std::ffi::c_void,
        descriptor: *mut *mut std::ffi::c_void,
    ) -> u32;
    fn SetNamedSecurityInfoW(
        name: *mut u16,
        kind: i32,
        info: u32,
        owner: *mut std::ffi::c_void,
        group: *mut std::ffi::c_void,
        dacl: *mut std::ffi::c_void,
        sacl: *mut std::ffi::c_void,
    ) -> u32;
}
#[cfg(windows)]
#[link(name = "advapi32")]
extern "system" {
    fn RegGetValueW(
        key: isize,
        subkey: *const u16,
        value: *const u16,
        flags: u32,
        kind: *mut u32,
        data: *mut std::ffi::c_void,
        size: *mut u32,
    ) -> i32;
}
// Whether a value under HKEY_CURRENT_USER can be read.
#[cfg(windows)]
fn reads_user_registry(subkey: &str, value: &str) -> bool {
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt, ptr::null_mut};
    const HKEY_CURRENT_USER: isize = 0x8000_0001u32 as i32 as isize;
    const RRF_RT_ANY: u32 = 0x0000_ffff;
    let w = |t: &str| {
        OsStr::new(t)
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<u16>>()
    };
    let (k, v) = (w(subkey), w(value));
    let mut buffer = [0u8; 256];
    let mut size = buffer.len() as u32;
    unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            k.as_ptr(),
            v.as_ptr(),
            RRF_RT_ANY,
            null_mut(),
            buffer.as_mut_ptr() as *mut _,
            &mut size,
        ) == 0
    }
}
#[cfg(not(windows))]
fn reads_user_registry(_subkey: &str, _value: &str) -> bool {
    false
}
#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn LocalFree(mem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
}
#[cfg(windows)]
fn can_rewrite_acl(folder: &str) -> bool {
    use std::{ffi::c_void, ffi::OsStr, os::windows::ffi::OsStrExt, ptr::null_mut};
    let mut name: Vec<u16> = OsStr::new(folder).encode_wide().chain(Some(0)).collect();
    let mut dacl: *mut c_void = null_mut();
    let mut descriptor: *mut c_void = null_mut();
    unsafe {
        let read = GetNamedSecurityInfoW(
            name.as_ptr(),
            1,
            4,
            null_mut(),
            null_mut(),
            &mut dacl,
            null_mut(),
            &mut descriptor,
        );
        if read != 0 || descriptor.is_null() || dacl.is_null() {
            return false;
        }
        // Attempt to apply the existing ACL unchanged. Proves WRITE_DAC cannot
        // be acquired without ever publishing a more permissive ACL.
        let result = SetNamedSecurityInfoW(
            name.as_mut_ptr(),
            1,
            4,
            null_mut(),
            null_mut(),
            dacl,
            null_mut(),
        );
        LocalFree(descriptor);
        result == 0
    }
}
#[cfg(not(windows))]
fn can_rewrite_acl(_folder: &str) -> bool {
    false
}
fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    match arg(&args, 0) {
        "args" => {
            println!(
                "{}",
                args.iter()
                    .skip(1)
                    .map(|a| hex(a))
                    .collect::<Vec<_>>()
                    .join(",")
            );
        }
        "env" => {
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis();
            let keys = env::vars().map(|(k, _)| k).collect::<Vec<_>>().join(",");
            println!("{ts}|{keys}");
        }
        "sleep" => loop {
            thread::sleep(Duration::from_secs(1));
        },
        "sleep-ms" => {
            thread::sleep(Duration::from_millis(
                arg(&args, 1).parse::<u64>().unwrap_or(1000),
            ));
        }
        "print" => {
            print!("{}", arg(&args, 1));
        }
        "exit" => {}
        "write" => {
            println!(
                "{} {}",
                if write(arg(&args, 1)) { "ok" } else { "denied" },
                if write(arg(&args, 2)) { "ok" } else { "denied" }
            );
        }
        "write-later" => {
            thread::sleep(Duration::from_millis(1500));
            print!("{}", if write(arg(&args, 1)) { "ok" } else { "denied" });
        }
        "child" => {
            print!("{}", if child() { "started" } else { "denied" });
        }
        "tree" => {
            let (count, pids) = tree(arg(&args, 1).parse().unwrap_or(1), arg(&args, 2));
            print!(
                "{count}|{}",
                pids.iter()
                    .map(|p| p.to_string())
                    .collect::<Vec<_>>()
                    .join(",")
            );
        }
        "orphan" => {
            // A child left behind on purpose: the job must end it.
            let exe = env::current_exe().unwrap_or_default();
            match Command::new(exe).args(["sleep-ms", arg(&args, 1)]).spawn() {
                Ok(c) => print!("{}", c.id()),
                Err(_) => print!("denied"),
            }
        }
        "spawn-hold" => {
            // Starts n long-lived children, reports their pids at once, then
            // holds: the owner, the wall budget or a cancel must end them all.
            use std::io::Write;
            let exe = env::current_exe().unwrap_or_default();
            let n: usize = arg(&args, 1).parse().unwrap_or(1);
            let pids: Vec<String> = (0..n)
                .filter_map(|_| Command::new(&exe).args(["sleep-ms", "120000"]).spawn().ok())
                .map(|c| c.id().to_string())
                .collect();
            println!("{}", pids.join(","));
            let _ = std::io::stdout().flush();
            thread::sleep(Duration::from_millis(
                arg(&args, 2).parse::<u64>().unwrap_or(60000),
            ));
        }
        "reg" => {
            print!(
                "{}",
                if reads_user_registry(arg(&args, 1), arg(&args, 2)) {
                    "read"
                } else {
                    "denied"
                }
            );
        }
        "dns" => {
            print!(
                "{}",
                if resolves(arg(&args, 1)) {
                    "resolved"
                } else {
                    "denied"
                }
            );
        }
        "acl" => {
            if !write(arg(&args, 1)) {
                process::exit(2);
            }
            println!(
                "{}",
                if can_rewrite_acl(arg(&args, 2)) {
                    "modified"
                } else {
                    "denied"
                }
            );
        }
        "hostile" => {
            // sentinel, token, launch, database, other media, granted file,
            // profile, workspace, sentinel dir, writable, port, LAN IP.
            let a = |i| arg(&args, i);
            let port = a(11).parse::<u16>().unwrap_or(0);
            let fields = [
                ("sentinel", read(a(1))),
                ("token", read(a(2))),
                ("launch", read(a(3))),
                ("database", read(a(4))),
                ("otherMedia", read(a(5))),
                ("granted", read(a(6))),
                ("profile", list(a(7))),
                ("workspace", list(a(8))),
                ("writeWorkspace", write(&format!("{}\\escape.txt", a(8)))),
                ("writeSentinelDir", write(&format!("{}\\escape.txt", a(9)))),
                ("writeOwn", write(&format!("{}\\ok.txt", a(10)))),
                ("child", child()),
                ("loopback", connect("127.0.0.1", port)),
                (
                    "lan",
                    if a(12).is_empty() {
                        false
                    } else {
                        connect(a(12), port)
                    },
                ),
            ];
            println!(
                "{{{}}}",
                fields
                    .iter()
                    .map(|(k, v)| format!("\"{k}\":{v}"))
                    .collect::<Vec<_>>()
                    .join(",")
            );
        }
        other => {
            eprintln!("Unknown worker-probe command: {other}");
            process::exit(2);
        }
    }
}
