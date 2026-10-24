/** Curated coverage facts; the official source is pinned independently of models. */
export const curriculum = Object.freeze({
  id:'cbse-043-2026-27-xii', board:'CBSE',standard:'12',subject:'Chemistry',academicYear:'2026-27',
  title:'CBSE Chemistry 043, Class XII, 2026–27',
  url:'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Chemistry_SecP2_2026-27.pdf',
  sourceSha256:'5610f09d357d3ccc9a7b39fc29cb7b1f4530847753783b16c72fff691acd2418',
  officialTheoryMarks:70, practicePaperMarks:80,
  notice:'An 80-mark Growth Tutorials practice paper, not the official 70-mark board-paper format.',
  chapters:[
    {id:'solutions',title:'Solutions',focus:'Concentration, ideal and non-ideal solutions, colligative properties and molar mass.'},
    {id:'electrochemistry',title:'Electrochemistry',focus:'Cells, electrode potential, Nernst equation, conductance, electrolysis and corrosion.'},
    {id:'chemical-kinetics',title:'Chemical Kinetics',focus:'Rate laws, order, integrated equations, temperature dependence and activation energy.'},
    {id:'d-f-block',title:'d- and f-Block Elements',focus:'Transition elements, compounds, lanthanoids and actinoids.'},
    {id:'coordination',title:'Coordination Compounds',focus:'Nomenclature, isomerism, bonding and applications.'},
    {id:'haloalkanes',title:'Haloalkanes and Haloarenes',focus:'Preparation, properties, substitution and applications.'},
    {id:'alcohols',title:'Alcohols, Phenols and Ethers',focus:'Preparation, physical properties and reactions.'},
    {id:'carbonyl',title:'Aldehydes, Ketones and Carboxylic Acids',focus:'Preparation, properties, reactions and conversions.'},
    {id:'amines',title:'Amines',focus:'Classification, preparation, basicity, reactions and diazonium salts.'},
    {id:'biomolecules',title:'Biomolecules',focus:'Carbohydrates, proteins, vitamins and nucleic acids.'},
  ],
});
export const defaults=Object.freeze({board:'CBSE',standard:'12',subject:'Chemistry',academicYear:'2026-27',scope:'full_syllabus',marks:80,durationMinutes:180,questionLanguage:'English',answerLanguage:'English',sourcePolicy:'original',internalChoices:true});
