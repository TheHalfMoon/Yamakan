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
#[cfg(windows)]
#[link(name = "advapi32")]
extern "system" {
    fn RegSetKeyValueW(
        key: isize,
        subkey: *const u16,
        value: *const u16,
        kind: u32,
        data: *const std::ffi::c_void,
        size: u32,
    ) -> i32;
}
#[cfg(windows)]
fn wide(t: &str) -> Vec<u16> {
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
    OsStr::new(t).encode_wide().chain(Some(0)).collect()
}
// HKEY_LOCAL_MACHINE for "hklm", else HKEY_CURRENT_USER.
#[cfg(windows)]
fn hive(name: &str) -> isize {
    (if name == "hklm" {
        0x8000_0002u32
    } else {
        0x8000_0001u32
    }) as i32 as isize
}
// Whether a registry value can be read.
#[cfg(windows)]
fn reads_registry(root: &str, subkey: &str, value: &str) -> bool {
    const RRF_RT_ANY: u32 = 0x0000_ffff;
    let (k, v) = (wide(subkey), wide(value));
    let mut buffer = [0u8; 256];
    let mut size = buffer.len() as u32;
    unsafe {
        RegGetValueW(
            hive(root),
            k.as_ptr(),
            v.as_ptr(),
            RRF_RT_ANY,
            std::ptr::null_mut(),
            buffer.as_mut_ptr() as *mut _,
            &mut size,
        ) == 0
    }
}
// Whether a registry value can be written (creating its key).
#[cfg(windows)]
fn writes_registry(root: &str, subkey: &str) -> bool {
    let (k, v) = (wide(subkey), wide("probe"));
    let data = [1u8, 0, 0, 0];
    unsafe {
        RegSetKeyValueW(
            hive(root),
            k.as_ptr(),
            v.as_ptr(),
            4,
            data.as_ptr() as *const _,
            4,
        ) == 0
    }
}
#[cfg(not(windows))]
fn reads_registry(_root: &str, _subkey: &str, _value: &str) -> bool {
    false
}
#[cfg(not(windows))]
fn writes_registry(_root: &str, _subkey: &str) -> bool {
    false
}
// Whether a COM class can be activated out of process: a server started
// outside the worker's job would be an escape.
#[cfg(windows)]
#[link(name = "ole32")]
extern "system" {
    fn CoInitializeEx(reserved: *mut std::ffi::c_void, flags: u32) -> i32;
    fn CLSIDFromProgID(progid: *const u16, clsid: *mut [u8; 16]) -> i32;
    fn CoCreateInstance(
        clsid: *const [u8; 16],
        outer: *mut std::ffi::c_void,
        context: u32,
        iid: *const [u8; 16],
        out: *mut *mut std::ffi::c_void,
    ) -> i32;
}
#[cfg(windows)]
fn activates_local_server(progid: &str) -> String {
    // IUnknown, activated with CLSCTX_LOCAL_SERVER.
    const IID_IUNKNOWN: [u8; 16] = [0, 0, 0, 0, 0, 0, 0, 0, 0xc0, 0, 0, 0, 0, 0, 0, 0x46];
    let mut clsid = [0u8; 16];
    let mut out: *mut std::ffi::c_void = std::ptr::null_mut();
    unsafe {
        // Without the COM runtime nothing below can run: reported as its own stage.
        let init = CoInitializeEx(std::ptr::null_mut(), 0);
        if init < 0 {
            return format!("noinit {init:#x}");
        }
        let found = CLSIDFromProgID(wide(progid).as_ptr(), &mut clsid);
        if found != 0 {
            return format!("noclass {found:#x}");
        }
        let hr = CoCreateInstance(&clsid, std::ptr::null_mut(), 0x4, &IID_IUNKNOWN, &mut out);
        if hr == 0 {
            "created".into()
        } else {
            format!("denied {hr:#x}")
        }
    }
}
#[cfg(not(windows))]
fn activates_local_server(_progid: &str) -> String {
    "denied".into()
}
#[cfg(windows)]
#[link(name = "oleaut32")]
extern "system" {
    fn SysAllocString(text: *const u16) -> *mut u16;
}
// Whether the WMI service accepts a connection to a namespace (root\cimv2
// has Win32_Process.Create, root\subscription permanent command-line
// consumers: both run a process outside the caller's job).
#[cfg(windows)]
fn connects_wmi(namespace: &str) -> String {
    const CLSID_WBEM_LOCATOR: [u8; 16] = [
        0x11, 0xf8, 0x90, 0x45, 0x3a, 0x1d, 0xd0, 0x11, 0x89, 0x1f, 0x00, 0xaa, 0x00, 0x4b, 0x2e,
        0x24,
    ];
    const IID_IWBEM_LOCATOR: [u8; 16] = [
        0x87, 0xa6, 0x12, 0xdc, 0x7f, 0x73, 0xcf, 0x11, 0x88, 0x4d, 0x00, 0xaa, 0x00, 0x4b, 0x2e,
        0x24,
    ];
    type Connect = unsafe extern "system" fn(
        this: *mut std::ffi::c_void,
        resource: *mut u16,
        user: *mut u16,
        password: *mut u16,
        locale: *mut u16,
        flags: i32,
        authority: *mut u16,
        context: *mut std::ffi::c_void,
        services: *mut *mut std::ffi::c_void,
    ) -> i32;
    let mut locator: *mut std::ffi::c_void = std::ptr::null_mut();
    unsafe {
        // Without the COM runtime nothing below can run: reported as its own stage.
        let init = CoInitializeEx(std::ptr::null_mut(), 0);
        if init < 0 {
            return format!("noinit {init:#x}");
        }
        let hr = CoCreateInstance(
            &CLSID_WBEM_LOCATOR,
            std::ptr::null_mut(),
            0x1,
            &IID_IWBEM_LOCATOR,
            &mut locator,
        );
        if hr != 0 {
            return format!("nolocator {hr:#x}");
        }
        // IWbemLocator: IUnknown's three methods, then ConnectServer.
        let vtable = *(locator as *const *const usize);
        let connect: Connect = std::mem::transmute(*vtable.add(3));
        let null = std::ptr::null_mut();
        let mut services: *mut std::ffi::c_void = std::ptr::null_mut();
        let hr = connect(
            locator,
            SysAllocString(wide(namespace).as_ptr()),
            null,
            null,
            null,
            0,
            null,
            std::ptr::null_mut(),
            &mut services,
        );
        if hr == 0 {
            "connected".into()
        } else {
            format!("denied connect {hr:#x}")
        }
    }
}
#[cfg(not(windows))]
fn connects_wmi(_namespace: &str) -> String {
    "denied".into()
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
            // It stays 2 s after starting the child, so a test can see the
            // child alive before the worker exits.
            match Command::new(exe).args(["sleep-ms", arg(&args, 1)]).spawn() {
                Ok(c) => {
                    use std::io::Write;
                    println!("{}", c.id());
                    let _ = std::io::stdout().flush();
                    thread::sleep(Duration::from_millis(2000));
                }
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
            // reg hive subkey value
            let read = reads_registry(arg(&args, 1), arg(&args, 2), arg(&args, 3));
            print!("{}", if read { "read" } else { "denied" });
        }
        "reg-write" => {
            let written = writes_registry(arg(&args, 1), arg(&args, 2));
            print!("{}", if written { "written" } else { "denied" });
        }
        "com" => {
            print!("{}", activates_local_server(arg(&args, 1)));
        }
        "wmi" => {
            print!("{}", connects_wmi(arg(&args, 1)));
        }
        "breakaway" => {
            // A child that asks to leave the job (CREATE_BREAKAWAY_FROM_JOB).
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                let exe = env::current_exe().unwrap_or_default();
                let started = Command::new(exe)
                    .args(["sleep-ms", "100"])
                    .creation_flags(0x0100_0000)
                    .spawn();
                match started {
                    Ok(mut c) => {
                        let _ = c.wait();
                        print!("started")
                    }
                    Err(e) => print!("denied {}", e.raw_os_error().unwrap_or(0)),
                }
            }
        }
        "flood" => {
            // Writes n MiB to stdout (the engine profile's output cap).
            use std::io::Write;
            let chunk = vec![b'x'; 1024 * 1024];
            let mut out = std::io::stdout().lock();
            for _ in 0..arg(&args, 1).parse::<usize>().unwrap_or(1) {
                if out.write_all(&chunk).is_err() {
                    break;
                }
            }
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
