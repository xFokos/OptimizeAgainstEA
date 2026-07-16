import { useState, type CSSProperties } from "react";
import PageContainer from "../components/layout/PageContainer";

// Showcase of every shared button style. The `.btn` action-button variants live
// in the global button primitive (src/styles/primitives/buttons.css), so this
// page just consumes the classes.

type Variant = { cls: string; label: string; note: string };

const ACTION_VARIANTS: Variant[] = [
    { cls: "btn",               label: "Default",  note: "neutral outline" },
    { cls: "btn btn--primary",  label: "Primary",  note: "solid accent CTA" },
    { cls: "btn btn--outline",  label: "Outline",  note: "blue border + text, dark fill" },
    { cls: "btn btn--soft",     label: "Soft",     note: "tonal blue tint" },
    { cls: "btn btn--ghost",    label: "Ghost",    note: "quiet / secondary" },
    { cls: "btn btn--blue",     label: "Blue",     note: "secondary-blue action" },
    { cls: "btn btn--gold",     label: "Gold",     note: "optimum / highlight" },
    { cls: "btn btn--danger",   label: "Danger",   note: "destructive" },
];

// Variants used in the selection demos — each keeps its own look when chosen.
const TOGGLE_VARIANTS: { label: string; cls: string }[] = [
    { label: "Primary", cls: "btn--primary" },
    { label: "Outline", cls: "btn--outline" },
    { label: "Soft",    cls: "btn--soft" },
];

export default function ButtonsPage() {
    const [active, setActive] = useState<string>("Primary");
    const [activeRecolour, setActiveRecolour] = useState<string>("Primary");
    const [sliderVal, setSliderVal] = useState<number>(0.4);
    const [modalOpen, setModalOpen] = useState<boolean>(false);

    return (
        <PageContainer>
            <div style={styles.page}>
                <h1 style={styles.title}>Button styles</h1>
                <p style={styles.subtitle}>
                    Shared components from <code>styles/primitives/buttons.css</code>.
                </p>

                {/* ── Action buttons (.btn) ─────────────────────────────── */}
                <Section title="Action buttons (.btn)">
                    <div style={styles.grid}>
                        {ACTION_VARIANTS.map(v => (
                            <div key={v.label} style={styles.cell}>
                                <button className={v.cls}>{v.label}</button>
                                <code style={styles.code}>.{v.cls.replace("btn ", "")}</code>
                                <span style={styles.note}>{v.note}</span>
                            </div>
                        ))}
                    </div>
                </Section>

                {/* ── Recolouring themeable variants ────────────────────── */}
                <Section title="Recolouring (.btn--outline / .btn--soft via --btn-color)">
                    <div style={styles.row}>
                        <button className="btn btn--outline">Default</button>
                        <button className="btn btn--outline btn--c-blue">.btn--c-blue</button>
                        <button className="btn btn--outline btn--c-gold">.btn--c-gold</button>
                        <button className="btn btn--outline btn--c-danger">.btn--c-danger</button>
                        <button
                            className="btn btn--outline"
                            style={{ "--btn-color": "#9b6cff" } as CSSProperties}
                        >
                            inline #9b6cff
                        </button>
                    </div>
                    <div style={styles.row}>
                        <button className="btn btn--soft">Default</button>
                        <button className="btn btn--soft btn--c-blue">.btn--c-blue</button>
                        <button className="btn btn--soft btn--c-gold">.btn--c-gold</button>
                        <button className="btn btn--soft btn--c-danger">.btn--c-danger</button>
                    </div>
                </Section>

                {/* ── States & sizes ────────────────────────────────────── */}
                <Section title="States & modifiers">
                    <div style={styles.row}>
                        <button className="btn btn--primary">Normal</button>
                        <button className="btn btn--primary" disabled>Disabled</button>
                        <button className="btn btn--sm btn--primary">Small (.btn--sm)</button>
                    </div>
                    <div style={{ ...styles.row, maxWidth: 320 }}>
                        <button className="btn btn--primary btn--block">Block (.btn--block)</button>
                    </div>
                </Section>

                {/* ── Selection ring (.btn--selected) ───────────────────── */}
                <Section title="Selected (.btn--selected — keeps each variant's style)">
                    <div style={styles.row}>
                        {TOGGLE_VARIANTS.map(t => (
                            <button
                                key={t.label}
                                className={`btn ${t.cls}${active === t.label ? " btn--selected" : ""}`}
                                onClick={() => setActive(t.label)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </Section>

                {/* ── Toggled-on recolour (.btn--active) ────────────────── */}
                <Section title="Toggled-on (.btn--active — recolours to accent)">
                    <div style={styles.row}>
                        {TOGGLE_VARIANTS.map(t => (
                            <button
                                key={t.label}
                                className={`btn ${activeRecolour === t.label ? "btn--active" : "btn--ghost"}`}
                                onClick={() => setActiveRecolour(t.label)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </Section>

                {/* ── Panels (.panel) ───────────────────────────────────── */}
                <Section title="Panels / cards (.panel)">
                    <div style={styles.grid}>
                        <div className="panel">
                            <code style={styles.code}>.panel</code>
                            <span style={styles.note}>default surface</span>
                        </div>
                        <div className="panel panel--surface">
                            <code style={styles.code}>.panel--surface</code>
                            <span style={styles.note}>darker opaque</span>
                        </div>
                        <div className="panel panel--elevated">
                            <code style={styles.code}>.panel--elevated</code>
                            <span style={styles.note}>raised</span>
                        </div>
                        <div className="panel panel--inset">
                            <code style={styles.code}>.panel--inset</code>
                            <span style={styles.note}>recessed sub-card</span>
                        </div>
                        <div className="panel panel--interactive">
                            <code style={styles.code}>.panel--interactive</code>
                            <span style={styles.note}>hover me</span>
                        </div>
                    </div>
                </Section>

                {/* ── Badges (.badge) ───────────────────────────────────── */}
                <Section title="Badges (.badge — themeable via --badge-color)">
                    <div style={styles.row}>
                        <span className="badge">DEFAULT</span>
                        <span className="badge badge--gold">GOLD</span>
                        <span className="badge badge--danger">DANGER</span>
                        <span className="badge badge--outline">OUTLINE</span>
                        <span className="badge badge--outline badge--gold">EA SOLVED IT</span>
                        <span className="badge" style={{ "--badge-color": "#c98bff" } as CSSProperties}>ELITE</span>
                    </div>
                </Section>

                {/* ── Eyebrows (.eyebrow) ───────────────────────────────── */}
                <Section title="Eyebrows (.eyebrow — small caps labels)">
                    <div style={{ ...styles.row, flexDirection: "column", alignItems: "flex-start", gap: 12, maxWidth: 360 }}>
                        <span className="eyebrow">Total rounds</span>
                        <span className="eyebrow eyebrow--divider" style={{ width: "100%" }}>Section heading</span>
                    </div>
                </Section>

                {/* ── Sliders (.slider) ─────────────────────────────────── */}
                <Section title="Sliders (.slider — themeable via --slider-accent)">
                    <div style={{ ...styles.row, flexDirection: "column", alignItems: "stretch", maxWidth: 360, gap: 16 }}>
                        <label style={styles.note}>Default — value {sliderVal.toFixed(2)}</label>
                        <input
                            type="range" className="slider"
                            min={0} max={1} step={0.01}
                            value={sliderVal}
                            onChange={e => setSliderVal(parseFloat(e.target.value))}
                        />
                        <label style={styles.note}>Custom accent (--slider-accent: #4af0a0)</label>
                        <input
                            type="range" className="slider"
                            min={0} max={1} step={0.01}
                            value={sliderVal}
                            onChange={e => setSliderVal(parseFloat(e.target.value))}
                            style={{ "--slider-accent": "#4af0a0" } as CSSProperties}
                        />
                        <input type="range" className="slider" defaultValue={50} disabled />
                    </div>
                </Section>

                {/* ── Modal / overlay (.overlay + .modal) ───────────────── */}
                <Section title="Modal / overlay (.overlay + .modal)">
                    <div style={styles.row}>
                        <button className="btn btn--primary" onClick={() => setModalOpen(true)}>
                            Open modal
                        </button>
                    </div>
                </Section>
            </div>

            {modalOpen && (
                <div className="overlay" onClick={() => setModalOpen(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>Example modal</h2>
                        <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
                            <code>.overlay</code> is the dimmed backdrop, <code>.modal</code> is the
                            centred box. Click the backdrop or the button to close.
                        </p>
                        <div style={{ ...styles.row, justifyContent: "flex-end" }}>
                            <button className="btn btn--ghost" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn--primary" onClick={() => setModalOpen(false)}>Done</button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={styles.section}>
            <div style={styles.sectionHead}>
                <span style={styles.sectionTitle}>{title}</span>
            </div>
            {children}
        </section>
    );
}

const styles: Record<string, CSSProperties> = {
    page: {
        width: "100%",
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 16px",
        overflowY: "auto",
        height: "100%",
        boxSizing: "border-box",
        color: "#fff",
    },
    title: { fontSize: 22, fontWeight: 600, margin: "0 0 4px 0", color: "rgba(255,255,255,0.9)" },
    subtitle: { fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 8px 0" },
    section: { margin: "28px 0" },
    sectionHead: { display: "flex", alignItems: "center", gap: 12, margin: "0 0 16px 0" },
    sectionTitle: {
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.3)",
        whiteSpace: "nowrap",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 16,
    },
    cell: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        padding: 16,
        borderRadius: 8,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
    },
    code: { fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "monospace" },
    note: { fontSize: 11, color: "rgba(255,255,255,0.3)" },
    row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 },
};
