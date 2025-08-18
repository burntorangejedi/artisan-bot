const ALL_PROFESSIONS = [
    'Alchemy', 'Blacksmithing', 'Enchanting', 'Engineering', 'Herbalism', 'Inscription',
    'Jewelcrafting', 'Leatherworking', 'Mining', 'Skinning', 'Tailoring'
];

const MAIN_ROLES = ['Tank', 'Healer', 'Ranged DPS', 'Melee DPS'];

const SPEC_ROLE_MAP = {
    // Druids
    "balance druid": "Ranged DPS",
    "feral druid": "Melee DPS",
    "guardian druid": "Tank",
    "restoration druid": "Healer",
    // Mages
    "arcane mage": "Ranged DPS",
    "fire mage": "Ranged DPS",
    "frost mage": "Ranged DPS",
    // Warriors
    "arms warrior": "Melee DPS",
    "fury warrior": "Melee DPS",
    "protection warrior": "Tank",
    // Paladins
    "holy paladin": "Healer",
    "protection paladin": "Tank",
    "retribution paladin": "Melee DPS",
    // Priests
    "discipline priest": "Healer",
    "holy priest": "Healer",
    "shadow priest": "Ranged DPS",
    // Rogues
    "assassination rogue": "Melee DPS",
    "outlaw rogue": "Melee DPS",
    "subtlety rogue": "Melee DPS",
    // Hunters
    "beast mastery hunter": "Ranged DPS",
    "marksmanship hunter": "Ranged DPS",
    "survival hunter": "Melee DPS",
    // Warlocks
    "affliction warlock": "Ranged DPS",
    "demonology warlock": "Ranged DPS",
    "destruction warlock": "Ranged DPS",
    // Death Knights
    "blood death knight": "Tank",
    "frost death knight": "Melee DPS",
    "unholy death knight": "Melee DPS",
    // Monks
    "brewmaster monk": "Tank",
    "mistweaver monk": "Healer",
    "windwalker monk": "Melee DPS",
    // Shamans
    "elemental shaman": "Ranged DPS",
    "enhancement shaman": "Melee DPS",
    "restoration shaman": "Healer",
    // Demon Hunters
    "havoc demon hunter": "Melee DPS",
    "vengeance demon hunter": "Tank",
    // Evokers
    "devastation evoker": "Ranged DPS",
    "preservation evoker": "Healer",
    "augmentation evoker": "Ranged DPS",
};

function getMainRoleForSpecClass(spec, charClass) {
    const key = `${spec} ${charClass}`.toLowerCase();
    const result = SPEC_ROLE_MAP[key] || null;
    debug.log(`getMainRoleForSpecClass: ${key} -> ${result}`);
    console.log(`getMainRoleForSpecClass: ${key} -> ${result}`);
    return result
}

module.exports = {
    ALL_PROFESSIONS,
    MAIN_ROLES,
    SPEC_ROLE_MAP,
    getMainRoleForSpecClass
};