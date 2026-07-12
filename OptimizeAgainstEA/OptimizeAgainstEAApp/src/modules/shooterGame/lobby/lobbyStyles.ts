// Shared inline-style objects for every lobby screen. Split by concern:
// `lobbyStyles` is the desktop grid shell, `tabStyles` the settings-tab chrome,
// `ovStyles` the Overview-tab panels (also reused by Horde's Overview), and the
// two mobile styles the phone layout wrappers.

export const ovStyles: Record<string, React.CSSProperties> = {
    layout: {
        display: 'flex',
        gap:     16,
        height:  260,
    },
    slot: {
        flex:          '0 0 50%',
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
    },
    // Surface chrome (background/border/radius/padding) comes from the shared
    // "panel panel--md" className — this only carries the flex layout.
    placeholder: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
        overflow:      'hidden',
    },
    placeholderHeading: {
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color:         'var(--text-muted)',
        flexShrink:    0,
    },
    presetBtns: {
        display:   'flex',
        gap:       6,
        flexShrink: 0,
    },
    presetBtn: {
        flex:          1,
        padding:       '9px 0',
        border:        '1px solid',
        borderRadius:  'var(--r-sm)',
        cursor:        'pointer',
        fontFamily:    'var(--font-mono)',
        fontSize:      13,
        fontWeight:    700,
        letterSpacing: '0.03em',
        transition:    'all 0.15s ease',
    },
    presetDesc: {
        fontSize:   13,
        color:      'var(--text-muted)',
        lineHeight: 1.5,
        margin:     0,
        flexShrink: 0,
    },
    emptySlot: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        border:        '1px dashed rgba(255,255,255,0.12)',
        borderRadius:  'var(--r-md)',
        padding:       '32px 28px 24px',
        textAlign:     'center',
    },
    // Surface chrome comes from "panel panel--md" — see placeholder above.
    activeSlot: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
    },
    slotIcon: {
        fontSize:  40,
        opacity:   0.45,
    },
    slotTitle: {
        fontFamily:    'var(--font-mono)',
        fontSize:      14,
        fontWeight:    700,
        color:         'rgba(255,255,255,0.35)',
        letterSpacing: '0.04em',
    },
    slotSub: {
        fontSize:   13,
        color:      'rgba(255,255,255,0.22)',
        lineHeight: 1.6,
    },

    header: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'baseline',
        flexShrink:     0,
    },
    roundLabel: {
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color:         'var(--text-muted)',
        marginBottom:  2,
    },
    roundValue: {
        fontFamily:  'var(--font-mono)',
        fontSize:    48,
        fontWeight:  700,
        color:       'var(--accent)',
        lineHeight:  1,
        textShadow:  '0 0 24px var(--accent-glow)',
    },


    divider: {
        height:     1,
        background: 'var(--border)',
    },
    dnaRow: {
        display:     'flex',
        gap:         3,
        flex:        1,
        flexWrap:    'wrap' as const,
        alignItems:  'center',
        marginLeft:  10,
    },
    dnaLabel: {
        fontFamily:    'var(--font-mono)',
        fontSize:      9,
        fontWeight:    700,
        letterSpacing: '0.06em',
        color:         'rgba(255,255,255,0.25)',
        marginRight:   4,
        flexShrink:    0,
    },
    dnaCell: {
        fontFamily: 'var(--font-mono)',
        fontSize:   9,
        color:      'rgba(255,255,255,0.35)',
        lineHeight: 1,
    },

    geneList: {
        display:             'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap:                 '10px 20px',
    },
    geneRow: {
        display:       'flex',
        flexDirection: 'column',
        gap:           4,
    },
    geneHeader: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'baseline',
    },
    geneName: {
        fontFamily:    'var(--font-mono)',
        fontSize:      13,
        color:         'var(--text-dim)',
        letterSpacing: '0.03em',
    },
    geneValue: {
        fontFamily: 'var(--font-mono)',
        fontSize:   14,
        fontWeight: 700,
        color:      'var(--accent)',
        flexShrink: 0,
    },
    geneDelta: {
        fontFamily: 'var(--font-mono)',
        fontSize:   12,
        fontWeight: 700,
        marginLeft: 6,
    },
    geneBarTrack: {
        height:       8,
        borderRadius: 4,
        background:   'var(--border)',
        overflow:     'hidden',
    },
    geneBarFill: {
        height:       '100%',
        borderRadius: 4,
        background:   'var(--accent)',
        opacity:      0.85,
        transition:   'width 0.2s ease',
    },

    statsCompact: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap:           4,
        minHeight:     0,
    },
    statsCompactRow: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'baseline',
        gap:            8,
    },
    statsCompactLabel: {
        fontFamily: 'var(--font-mono)',
        fontSize:   12,
        color:      'var(--text-muted)',
    },
    statsCompactValue: {
        fontFamily: 'var(--font-mono)',
        fontSize:   13,
        fontWeight: 700,
        color:      'rgba(255,255,255,0.8)',
    },

};

// ---- Settings Tabs ----

export const tabStyles: Record<string, React.CSSProperties> = {
    shell: {
        display:       'flex',
        flexDirection: 'column',
        gap:           0,
        minWidth:      0,
        flex:          1,
        minHeight:     0,
        overflow:      'hidden',
    },
    bar: {
        display:      'flex',
        gap:          6,
        marginBottom: 16,
    },
    tabActive: {
        padding:       '8px 16px',
        background:    'var(--accent-dim)',
        border:        '1px solid var(--accent)',
        borderRadius:  'var(--r-sm)',
        color:         'var(--accent)',
        cursor:        'pointer',
        fontSize:      '13px',
        fontFamily:    'var(--font-mono)',
        fontWeight:    600,
        letterSpacing: '0.03em',
    },
    tabInactive: {
        padding:       '8px 16px',
        background:    'transparent',
        border:        '1px solid var(--border)',
        borderRadius:  'var(--r-sm)',
        color:         'var(--text-dim)',
        cursor:        'pointer',
        fontSize:      '13px',
        fontFamily:    'var(--font-mono)',
        fontWeight:    600,
        letterSpacing: '0.03em',
    },
    panel: {
        flex:      1,
        minHeight: 0,
        overflowY: 'auto',
    },
    sectionLabel: {
        fontSize:      '12px',
        color:         'var(--text-muted)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        margin:        '0 0 12px 0',
        fontFamily:    'var(--font-mono)',
    },
    resetBtn: {
        marginTop:    '12px',
        padding:      '8px 18px',
        background:   'transparent',
        border:       '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        color:        'var(--text-muted)',
        cursor:       'pointer',
        fontFamily:   'var(--font)',
        fontSize:     '13px',
    },

};

// ---- Shared Mobile Styles ----

export const mobilePageStyle: React.CSSProperties = {
    display:       'flex',
    flexDirection: 'column',
    gap:           16,
    padding:       '16px',
    boxSizing:     'border-box',
};

export const mobileBtnsStyle: React.CSSProperties = {
    display:    'flex',
    gap:        10,
    flexShrink: 0,
    paddingTop: 4,
};

// ---- Shared Lobby Styles (same layout for all modes) ----

export const lobbyStyles: Record<string, React.CSSProperties> = {
    page: {
        display:             'grid',
        gridTemplateColumns: 'auto 1fr',
        gridTemplateRows:    '1fr auto',
        width:               '100%',
        height:              '100%',
        columnGap:           '32px',
        padding:             '24px 32px',
        boxSizing:           'border-box',
        overflow:            'hidden',
    },
    leftTop: {
        display:       'flex',
        flexDirection: 'column',
        minHeight:     0,
        overflow:      'visible', // must not clip — Compi pokes outside the help button's box below
        gridRow:       '1 / 3', // spans both rows so the help button sits right under the canvas, independent of the right column's height
    },
    leftTopPreview: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '12px',
        flexShrink:    0,
    },
    leftTopHelpSlot: {
        flex:           1,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      0,
    },
    rightTop: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '16px',
        minWidth:      0,
        minHeight:     0,
        overflow:      'hidden',
    },
    rightBottom: {
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '24px 0 0',
    },
    brand: {
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           '8px',
        paddingBottom: '12px',
        borderBottom:  '1px solid rgba(255,255,255,0.07)',
    },
    brandLogo: {
        width:          '48px',
        height:         '48px',
        borderRadius:   '12px',
        background:     'rgba(79, 195, 247, 0.12)',
        border:         '1px solid rgba(79, 195, 247, 0.25)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontSize:       '15px',
        fontWeight:     700,
        letterSpacing:  '0.05em',
        color:          '#4fc3f7',
        fontFamily:     'var(--font-mono)',
    },
    brandName: {
        fontSize:      '11px',
        fontWeight:    600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.1em',
        color:         'rgba(255,255,255,0.28)',
        textAlign:     'center' as const,
        fontFamily:    'var(--font-mono)',
    },
    previewLabel: {
        fontSize:      '11px',
        color:         'rgba(255,255,255,0.25)',
        textAlign:     'center',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontFamily:    'var(--font-mono)',
    },
    header: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '8px',
    },
    title: {
        fontFamily: 'var(--font-mono)',
        fontSize:   '26px',
        fontWeight: 600,
        color:      'rgba(255,255,255,0.9)',
        margin:     0,
    },
    description: {
        fontFamily:  'var(--font)',
        fontSize:    '14px',
        color:       'rgba(255,255,255,0.5)',
        lineHeight:  1.55,
        margin:      0,
    },
};
