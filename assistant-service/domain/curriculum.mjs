/** Curated coverage facts; the official source is pinned independently of models. */
export const curriculum = Object.freeze({
  id:'cbse-043-2026-27-xii', board:'CBSE',standard:'12',subject:'Chemistry',academicYear:'2026-27',
  title:'CBSE Chemistry 043, Class XII, 2026–27',
  url:'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Chemistry_SecP2_2026-27.pdf',
  sourceSha256:'5610f09d357d3ccc9a7b39fc29cb7b1f4530847753783b16c72fff691acd2418',
  officialTheoryMarks:70,
  provenance:{kind:'official-pinned-syllabus',yearVerified:true,patternVerified:false,coverage:'full_syllabus'},
  notice:'Custom Growth Tutorials practice paper based on the CBSE Chemistry syllabus. Teacher review is required.',
  chapters:[
    {id:'solutions',title:'Solutions',aliases:['Solution'],focus:'Solution types and concentration, solubility, vapour pressure, ideal and non-ideal solutions, colligative properties and determination of normal or abnormal molar mass.'},
    {id:'electrochemistry',title:'Electrochemistry',focus:'Electrochemical, galvanic and electrolytic cells, electrode potential, the Nernst equation, conductance, electrolysis, batteries, fuel cells and corrosion.'},
    {id:'chemical-kinetics',title:'Chemical Kinetics',focus:'Rate laws, order, integrated equations, temperature dependence and activation energy.'},
    {id:'d-f-block',title:'d- and f-Block Elements',focus:'Transition elements, compounds, lanthanoids and actinoids.'},
    {id:'coordination',title:'Coordination Compounds',focus:'Nomenclature, isomerism, bonding and applications.'},
    {id:'haloalkanes',title:'Haloalkanes and Haloarenes',aliases:['Haloalkanes Haloarenes','Haloalkanes Haloarines'],focus:'Classification, nomenclature, carbon–halogen bonding, preparation of both compound groups, physical properties, reactions and polyhalogen compounds.'},
    {id:'alcohols',title:'Alcohols, Phenols and Ethers',aliases:['Alcohol phenols and ethers'],focus:'Classification, nomenclature and functional-group structures, preparation, properties, reactions and commercially important alcohols.'},
    {id:'carbonyl',title:'Aldehydes, Ketones and Carboxylic Acids',focus:'Preparation, properties, reactions and conversions.'},
    {id:'amines',title:'Amines',focus:'Structure, classification, nomenclature, preparation, physical properties, basicity and reactions of amines, plus preparation, properties, reactions and synthetic uses of diazonium salts.'},
    {id:'biomolecules',title:'Biomolecules',focus:'Carbohydrates, proteins, vitamins and nucleic acids.'},
  ],
});

const reproductionChapters=[
  {id:'sexual-reproduction-in-flowering-plants',title:'Sexual Reproduction in Flowering Plants',focus:'Floral structures, male and female gametophytes, pollination modes and agents, outbreeding devices, pollen–pistil interaction, double fertilisation, development of endosperm, embryo, seed and fruit, apomixis, parthenocarpy, polyembryony and the significance of seed dispersal and fruits.'},
  {id:'human-reproduction',title:'Human Reproduction',focus:'Male and female reproductive systems, testis and ovary microanatomy, spermatogenesis, oogenesis, menstrual cycle, fertilisation, development through the blastocyst stage, implantation and an elementary treatment of pregnancy, placenta, birth and lactation.'},
  {id:'reproductive-health',title:'Reproductive Health',focus:'Reproductive health and prevention of sexually transmitted diseases, the need for birth control and its methods, contraception, medical termination of pregnancy, amniocentesis, infertility and introductory awareness of IVF, ZIFT and GIFT.'},
];

const biologyReproduction=Object.freeze({
  id:'cbse-044-2026-27-xii-unit-vi',board:'CBSE',standard:'12',subject:'Biology',academicYear:'2026-27',
  title:'CBSE Biology 044 Class XII, 2026–27, Unit VI Reproduction',
  url:'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Biology_SecP2_2026-27.pdf',
  officialTheoryMarks:70,
  chapters:reproductionChapters,
  units:[{
    title:'Unit VI Reproduction',
    aliases:['first unit','unit vi','unit 6','unit vi reproduction','unit 6 reproduction','reproduction unit'],
    chapterIds:reproductionChapters.map(chapter=>chapter.id),publishedMarks:16,
  }],
  sources:[
    {title:'CBSE Biology 044 curriculum',url:'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Biology_SecP2_2026-27.pdf',applicableYear:'2026-27',locator:'Printed page 9, Class XII theory course structure and Unit VI; page 14, prescribed textbooks'},
    {title:'NCERT Class XII Biology textbook contents',url:'https://ncert.nic.in/textbook/pdf/lebo1ps.pdf',applicableYear:'2025-26 reprint',locator:'Contents, printed page XI, Unit VI and chapters 1–3'},
  ],
  provenance:{kind:'official-pinned-unit',yearVerified:true,patternVerified:false,coverage:'selected_chapters'},
  notice:'Custom Growth Tutorials practice paper based on the verified Reproduction unit of the CBSE Class XII Biology syllabus. Teacher review is required.',
});

export function unitMatches(name,unit){
  const label=name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()
    .replace(/^the /,'').replace(/ from (?:the )?ncert(?: (?:textbook|book))?$/,'');
  return unit.aliases?.includes(label)===true;
}

export function pinnedUnitCurriculum(requirements){
  const pinned=biologyReproduction;
  if(requirements.format==='board'||requirements.scope!=='selected_chapters'||requirements.board!==pinned.board||String(requirements.standard)!==pinned.standard||requirements.subject!==pinned.subject||requirements.academicYear!==pinned.academicYear)return null;
  if(['programme','level','subjectCode','examYear','edition'].some(key=>requirements[key]))return null;
  return Array.isArray(requirements.selectedChapters)&&requirements.selectedChapters.some(name=>typeof name==='string'&&unitMatches(name,pinned.units[0]))?pinned:null;
}

export const defaults=Object.freeze({board:'CBSE',standard:'12',subject:'Chemistry',academicYear:'2026-27',scope:'full_syllabus',marks:80,durationMinutes:180,questionLanguage:'English',answerLanguage:'English',sourcePolicy:'original',internalChoices:true});
