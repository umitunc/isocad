export type LocaleCode = 'tr' | 'en' | 'ru';

export interface TranslationDict {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    features: string;
    architecture: string;
    faq: string;
    docs: string;
    liveDemo: string;
    launchDemo: string;
  };
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    ctaDemo: string;
    ctaDocs: string;
  };
  bento: {
    title: string;
    subtitle: string;
    c1Title: string;
    c1Desc: string;
    c2Title: string;
    c2Desc: string;
    c3Title: string;
    c3Desc: string;
    c4Title: string;
    c4Desc: string;
  };
  arch: {
    eyebrow: string;
    title: string;
    desc: string;
  };
  faq: {
    title: string;
    items: Array<{ q: string; a: string }>;
  };
  editor: {
    uploadPdf: string;
    autoExtract: string;
    autoStamp: string;
    exportPdf: string;
    exportExcel: string;
    exportDxf: string;
    pushApi: string;
    drawingSelection: string;
    drawingType: string;
    drawingNo: string;
    pdfFile: string;
    editMode: string;
    modeCad: string;
    modeJoints: string;
    modeJointsWelder: string;
    weldmapData: string;
    spoolNo: string;
    jointNo: string;
    welderId: string;
    addStamp: string;
    layers: string;
    actionHistory: string;
    noLayers: string;
    noActions: string;
    cmdPlaceholder: string;
    unsavedTitle: string;
    saveSuccess: string;
    calibrateScale: string;
  };
  drawer: {
    mto: string;
    weldLog: string;
    cutList: string;
    supports: string;
    exportXlsx: string;
    emptyHint: string;
  };
  modal: {
    jointTitle: string;
    typeOfJoint: string;
    typeOfWeld: string;
    drawJointNo: string;
    jointNo: string;
    weldingDate: string;
    spool1: string;
    spool2: string;
    pose1: string;
    pose2: string;
    member1: string;
    member2: string;
    material: string;
    dia1: string;
    dia2: string;
    nps1: string;
    nps2: string;
    thk1: string;
    thk2: string;
    cancel: string;
    save: string;
  };
  endpoint: {
    title: string;
    adapter: string;
    url: string;
    method: string;
    authType: string;
    token: string;
    stage: string;
    includePdf: string;
    sendNow: string;
    liveInspector: string;
  };
}
