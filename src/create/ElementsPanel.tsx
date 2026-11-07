// Places, props, wardrobe, style and made-up characters kept with the project. They are records for now: no
// model receives them, and this says so where they are made.
import { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../i18n.ts";
import { mediaUrl } from "../session.ts";
import {
  ELEMENT_IMAGE_TYPES,
  ELEMENT_ROLES,
  elementIsFull,
  newElementPack,
  pinElement,
  unpinElement,
  validElementName,
  withImage,
  type ElementPack,
  type ElementRole,
  type KeptElement,
} from "./create-elements.ts";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

type StoryShot = {
  id: string;
  name: string;
  referencePacks: { documentId: string; contentHash: string }[];
};
type PinnableStory = { scenes: { shots: StoryShot[] }[] };

export type ElementsApi = {
  load: () => Promise<KeptElement[]>;
  // The new version, or null if it could not be kept: what happened is shown elsewhere.
  save: (next: {
    documentId: string;
    expectedContentHash: string | null;
    pack: ElementPack;
  }) => Promise<KeptElement | null>;
  importImage: (
    file: File,
  ) => Promise<{ id: string; hash: string; name: string } | null | "busy">;
};

const ROLE_NAMES: Record<ElementRole, MessageKey> = {
  environment: "create.elementRole.environment",
  prop: "create.elementRole.prop",
  wardrobe: "create.elementRole.wardrobe",
  style: "create.elementRole.style",
  "fictional-character": "create.elementRole.fictional",
};

export function ElementsPanel<S extends PinnableStory>(props: {
  projectId: string;
  busy: boolean;
  revision: number;
  t: Translate;
  api: ElementsApi;
  story: S | null;
  saveStory: (next: S) => Promise<boolean>;
}) {
  const { projectId, busy, t, api, story } = props;
  const [elements, setElements] = useState<KeptElement[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState<ElementRole>("environment");
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const [working, setWorking] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  // A load begun before a save knows less than that save does.
  const loads = useRef(0);
  const shots = story?.scenes.flatMap((scene) => scene.shots) ?? [];

  // A restore or undo can change what the project holds.
  useEffect(() => {
    let current = true;
    const started = ++loads.current;
    api
      .load()
      .then((found) => {
        if (!current || started !== loads.current) return;
        setElements(found);
        setProblem((was) => (was === "create.elementsUnread" ? null : was));
      })
      .catch(() => {
        if (current) setProblem("create.elementsUnread");
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.revision]);

  const receive = async (file: File) => {
    if (!(ELEMENT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setProblem("create.elementImageType");
      return;
    }
    const existing = elements.find((e) => e.documentId === adding);
    // It went while the picker was open: this image was not meant for a new one.
    if (adding && !existing) {
      setProblem("create.elementGone");
      return;
    }
    // Before the image comes in: it would stay in the project with nowhere to go.
    if (existing && elementIsFull(existing.pack)) {
      setProblem("create.elementFull");
      return;
    }
    setProblem(null);
    setWorking(true);
    try {
      const asset = await api.importImage(file);
      if (asset === "busy" || !asset) {
        setProblem("create.elementNotKept");
        return;
      }
      const image = {
        assetId: asset.id,
        assetHash: asset.hash,
        name: asset.name,
      };
      const pack = existing
        ? withImage(existing.pack, existing.pack.entries[0].role, image, () =>
            crypto.randomUUID(),
          )
        : newElementPack(name, role, image, () => crypto.randomUUID());
      if (pack === "full") {
        setProblem("create.elementFull");
        return;
      }
      const kept = await api.save({
        documentId: existing?.documentId ?? crypto.randomUUID(),
        expectedContentHash: existing?.contentHash ?? null,
        pack,
      });
      if (!kept) {
        // The image did come in, and it stays in the project's assets.
        setProblem("create.elementImageOnly");
        return;
      }
      loads.current++;
      setElements((all) => [
        ...all.filter((e) => e.documentId !== kept.documentId),
        kept,
      ]);
      // The next one is its own statement: saying one is made up does not carry over.
      if (!existing) {
        setName("");
        setRole("environment");
      }
    } finally {
      setAdding(null);
      setWorking(false);
    }
  };

  const changePins = async (next: S | "full") => {
    if (next === "full") {
      setProblem("create.elementShotFull");
      return;
    }
    setProblem(null);
    setWorking(true);
    try {
      if (!(await props.saveStory(next))) setProblem("create.elementNotPinned");
    } finally {
      setWorking(false);
    }
  };

  const off = busy || working;
  return (
    <section className="create-elements" data-testid="create-elements">
      <h3>{t("create.elementsTitle")}</h3>
      <p className="note" data-testid="create-elements-note">
        {t("create.elementsNote")}
      </p>
      <div className="create-element-new">
        <label>
          {t("create.elementName")}
          <input
            data-testid="create-element-name"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {t("create.elementRole")}
          <select
            data-testid="create-element-role"
            value={role}
            onChange={(e) => setRole(e.target.value as ElementRole)}
          >
            {ELEMENT_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(ROLE_NAMES[r])}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          data-testid="create-element-add"
          disabled={off || !validElementName(name)}
          onClick={() => {
            setAdding(null);
            picker.current?.click();
          }}
        >
          {t("create.elementAdd")}
        </button>
        <input
          ref={picker}
          type="file"
          hidden
          data-testid="create-element-file"
          accept={ELEMENT_IMAGE_TYPES.join(",")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void receive(file);
          }}
        />
      </div>
      {problem && (
        <p role="alert" className="create-problem">
          {t(problem)}
        </p>
      )}
      {elements.length > 0 && (
        <ul className="create-element-list">
          {elements.map((element) => (
            <li key={element.documentId} data-testid="create-element">
              <div className="create-element-images">
                {element.pack.entries.map((entry) => (
                  <img
                    key={entry.id}
                    alt={entry.label}
                    loading="lazy"
                    src={mediaUrl(
                      `/api/v1/projects/${projectId}/assets/${entry.assetId}`,
                    )}
                  />
                ))}
              </div>
              <strong>
                <bdi>{element.pack.name}</bdi>
              </strong>
              <small>{t(ROLE_NAMES[element.pack.entries[0].role])}</small>
              <button
                type="button"
                data-testid="create-element-more"
                aria-label={`${t("create.elementAddImage")}: ${element.pack.name}`}
                disabled={off}
                onClick={() => {
                  setAdding(element.documentId);
                  picker.current?.click();
                }}
              >
                {t("create.elementAddImage")}
              </button>
              {shots.length > 0 && story && (
                <fieldset
                  className="create-element-shots"
                  aria-label={`${t("create.elementOnShots")}: ${element.pack.name}`}
                >
                  <legend>{t("create.elementOnShots")}</legend>
                  {shots.map((shot) => {
                    const pin = shot.referencePacks.find(
                      (p) => p.documentId === element.documentId,
                    );
                    return (
                      <label key={shot.id}>
                        <input
                          type="checkbox"
                          data-testid="create-element-pin"
                          disabled={off}
                          checked={Boolean(pin)}
                          onChange={(e) =>
                            void changePins(
                              e.target.checked
                                ? pinElement(story, shot.id, element)
                                : unpinElement(
                                    story,
                                    shot.id,
                                    element.documentId,
                                  ),
                            )
                          }
                        />
                        <bdi>{shot.name}</bdi>
                        {pin && pin.contentHash !== element.contentHash && (
                          <small data-testid="create-element-older">
                            {t("create.elementOlder")}
                          </small>
                        )}
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
