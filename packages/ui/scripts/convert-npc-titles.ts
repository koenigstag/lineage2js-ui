/**
 * Converts lineage2ts's npc datapack CSV into public/npc-titles/{en,ru}.json
 * -- the rank line ("Blacksmith", "Gatekeeper", ...) the retail client stacks
 * above an npc's name.
 *
 * None of this comes off the wire either, and for a sharper reason than the
 * item tables: NpcInfo *has* a title field, and the server deliberately sends
 * it empty. lineage2ts's NpcData sets `usingServerSideTitle = false` on every
 * template, and L2Npc.getGeneratedTitle() only returns the template's own
 * title when that flag is on -- otherwise it falls through to
 * L2Character.getTitle(), which is `return ''`. A real client resolves the
 * string from its own local table; this is ours. (Confirmed live: the
 * original client shows titles against the very same server that sends this
 * client nothing.)
 *
 * Source: https://gitlab.com/MrTREX/lineage2ts/-/blob/master/cli/overrides/data/csv/npc/npcProperties.csv
 * Download it to scripts/data/npcProperties.csv (or pass a path as the first
 * argument) and run:
 *
 *   pnpm --filter @lineage2js/ui convert:npc-titles
 *
 * Same deal as convert-items-csv.ts: the CSV isn't committed, the derived
 * tables are.
 *
 * The Russian half is unlike every other public/ table here. The others come
 * from adrenalinebot.com's HighFive database, which has no title data, and no
 * RU client ships an NpcName-ru.dat to read the official strings out of --
 * so TITLES_RU below is hand-written. It is small enough to be worth it:
 * 3696 titled npcs share only 474 distinct titles. Town names in it are at
 * least the genuine localization, lifted from public/item-names/ru.json's
 * Scroll of Escape entries (Аден, Гиран, Шутгарт, ...), and profession words
 * follow public/class-names/ru.json. Anything else is a translation, not a
 * quotation -- fix it freely if the wording is off.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_INPUT = path.join(__dirname, "data", "npcProperties.csv");
const OUTPUT_DIR = path.join(__dirname, "..", "public", "npc-titles");

/** English title -> Russian. Must cover the CSV exactly; see checkCoverage(). */
const TITLES_RU: Record<string, string> = {
  "Raid Fighter": "Рейд Боец",
  "Quest Monster": "Квестовый Монстр",
  "Raid Boss": "Рейд Босс",
  Guard: "Стражник",
  Master: "Мастер",
  "Control Room": "Пункт Управления",
  "Support Unit": "Отряд Поддержки",
  Aden: "Аден",
  Magister: "Магистр",
  Oren: "Орен",
  Rune: "Руна",
  Schuttgart: "Шутгарт",
  Goddard: "Годдард",
  Giran: "Гиран",
  "Warehouse Keeper": "Хранитель Склада",
  "Grand Master": "Великий Мастер",
  Gludio: "Глудио",
  Dion: "Дион",
  Innadril: "Иннадрил",
  Gatekeeper: "Хранитель Врат",
  "Follower of Destruction": "Последователь Разрушения",
  Archer: "Лучник",
  "Clan Hall Gatekeeper": "Хранитель Врат Холла Клана",
  "Clan Hall Manager": "Управляющий Холла Клана",
  Priest: "Жрец",
  "Lord of Destruction": "Владыка Разрушения",
  "Accessory Merchant": "Торговец Аксессуарами",
  "Officer's Barracks": "Казармы Офицеров",
  Grocer: "Бакалейщик",
  "Fishing Guild Member": "Член Гильдии Рыбаков",
  "Weapon Merchant": "Торговец Оружием",
  "Armor Merchant": "Торговец Доспехами",
  Blacksmith: "Кузнец",
  Soldier: "Солдат",
  "Event Manager": "Организатор Событий",
  Kaneus: "Канеус",
  "Spellbook Seller": "Продавец Книг Заклинаний",
  "Southern Fortress": "Южная Крепость",
  "Valley Fortress": "Крепость Долины",
  "Bayou Fortress": "Крепость Топей",
  "Borderland Fortress": "Пограничная Крепость",
  "Swamp Fortress": "Болотная Крепость",
  "Floran Fortress": "Крепость Флоран",
  "Cloud Mountain": "Облачная Гора",
  "Antharas's Fortress": "Крепость Антараса",
  "Western Fortress": "Западная Крепость",
  "Hunter's Fortress": "Крепость Охотников",
  "Demon Fortress": "Крепость Демонов",
  "Monastic Fortress": "Монастырская Крепость",
  "Warehouse Chief": "Начальник Склада",
  "Shanty Fortress": "Крепость Лачуг",
  "Hive Fortress": "Крепость Улья",
  "Ivory Fortress": "Крепость Слоновой Кости",
  "Narsell Fortress": "Крепость Нарселл",
  "White Sands Fortress": "Крепость Белых Песков",
  "Archaic Fortress": "Древняя Крепость",
  "Tanor Fortress": "Крепость Танор",
  "Dragonspine Fortress": "Крепость Драконьего Хребта",
  "Aaru Fortress": "Крепость Аару",
  Captain: "Капитан",
  "Head Blacksmith": "Главный Кузнец",
  Prefect: "Префект",
  Seer: "Провидец",
  "Grand Magister": "Великий Магистр",
  "High Priest": "Верховный Жрец",
  "High Prefect": "Верховный Префект",
  Doppler: "Доплер",
  Void: "Пустота",
  "Amulet Seller": "Продавец Амулетов",
  "For Test": "Для Теста",
  Marksman: "Стрелок",
  "Event manager": "Организатор Событий",
  "Pet Manager": "Смотритель Питомцев",
  "Symbol Maker": "Мастер Символов",
  "Blueprint Seller": "Продавец Чертежей",
  "Mineral Trader": "Торговец Минералами",
  "Adventure Guildsman": "Член Гильдии Авантюристов",
  "Recipe Merchant": "Торговец Рецептами",
  "Wyvern Manager": "Смотритель Виверн",
  "Forsaken Prisoner": "Забытый Узник",
  "Forsaken Inmate": "Забытый Заключенный",
  Trader: "Торговец",
  Investigator: "Следователь",
  "Spirit Infested": "Одержимый Духом",
  "Orc Betrayer": "Орк-Предатель",
  Priestess: "Жрица",
  Sentinel: "Часовой",
  Sentry: "Дозорный",
  "Abyssal Saintess": "Святая Бездны",
  Chamberlain: "Управляющий",
  Photographer: "Фотограф",
  "Kaboo Chief": "Вождь Кабу",
  Summoner: "Призыватель",
  Sir: "Сэр",
  "Mercenary Manager": "Управляющий Наемниками",
  Defender: "Защитник",
  Centurion: "Центурион",
  "Adventurers' Guide": "Проводник Авантюристов",
  Messenger: "Посланник",
  "Beginner Supporter": "Помощник Новичков",
  Sinister: "Зловещий",
  "Event Monster": "Праздничный Монстр",
  "Invaders' Leader": "Предводитель Захватчиков",
  "Invading Forces": "Силы Вторжения",
  "Invader of Dream": "Захватчик Снов",
  Collector: "Коллекционер",
  "Vice Hierarch": "Заместитель Иерарха",
  Officer: "Офицер",
  "Merry Christmas~": "С Рождеством~",
  "Ice Queen": "Ледяная Королева",
  "Jinia Guild": "Гильдия Джинии",
  Scout: "Разведчик",
  Lunatic: "Безумец",
  Bistakon: "Бистакон",
  Warden: "Смотритель",
  "Wharf Manager": "Управляющий Пристанью",
  Hierarch: "Иерарх",
  Witch: "Ведьма",
  Researcher: "Исследователь",
  "Aerial Cleft": "Воздушный Разлом",
  "Solina's Disciple": "Ученик Солины",
  "The Spirit of Fortune": "Дух Удачи",
  Panuka: "Панука",
  Tame: "Прирученный",
  Golden: "Золотой",
  Reptilikon: "Рептиликон",
  Kokracon: "Кокракон",
  Tracker: "Следопыт",
  "Ruler of Sepulcher": "Владыка Гробницы",
  Ice: "Ледяной",
  "Naia Shambler": "Шатун Наий",
  "Shadow of Violence": "Тень Насилия",
  "Family of Valakas": "Семья Валакаса",
  "Abyssal Celebrant": "Служитель Бездны",
  Tetrarch: "Тетрарх",
  "Kratei's Cube": "Куб Кратея",
  "Entrance Manager": "Управляющий Входом",
  "Maitre 'D": "Метрдотель",
  "Halloween's Three Siblings": "Три Брата Хэллоуина",
  "Customer Joining": "Прием Посетителей",
  "Tower of Naia": "Башня Наий",
  "Head of the Embryo": "Глава Эмбрио",
  "Darion's Challenger": "Претендент Дариона",
  Chaos: "Хаос",
  "Witch of the Dragon of Darkness": "Ведьма Дракона Тьмы",
  "Priest of the Earth": "Жрец Земли",
  Khavatari: "Хаватари",
  Maestro: "Маэстро",
  Bard: "Бард",
  "Guild President": "Глава Гильдии",
  Mercenary: "Наемник",
  "Royal Servant": "Королевский Слуга",
  Drake: "Дрейк",
  "Border Outpost Captain": "Капитан Пограничной Заставы",
  "Information Broker": "Информатор",
  Teleporter: "Телепортер",
  Steward: "Управляющий",
  "Eva's High Priest": "Верховный Жрец Эвы",
  "Blessed Child": "Благословенное Дитя",
  Gracia: "Грация",
  "Spirit of Fire": "Дух Огня",
  "Spirit of Water": "Дух Воды",
  Final: "Последний",
  "Vice Inspector": "Заместитель Инспектора",
  "Subordinate of King": "Подчиненный Короля",
  "Enira's Evil Spirit": "Злой Дух Эниры",
  "Underling of Destruction": "Прислужник Разрушения",
  "Archery Knight Captain": "Капитан Рыцарей-Лучников",
  "Holy Mother of Abyss": "Святая Мать Бездны",
  "Flames of Sacred Fire": "Пламя Священного Огня",
  "High Priestess": "Верховная Жрица",
  "Dye Merchant": "Торговец Красителями",
  "Magic Trader": "Торговец Магией",
  Miner: "Шахтер",
  Carrier: "Носильщик",
  Elder: "Мудрец",
  Drunkard: "Пьяница",
  Bodyguard: "Телохранитель",
  "Mercenary Captain": "Капитан Наемников",
  "Guild Member": "Член Гильдии",
  Wyrm: "Вирм",
  "Antharas Watchman": "Дозорный Антараса",
  Musician: "Музыкант",
  "Resurrected Adventurer": "Воскрешенный Авантюрист",
  "Melody Maestro": "Маэстро Мелодий",
  "Valley Trader": "Торговец Долины",
  "Level 31 and Below": "Уровень 31 и Ниже",
  "Level 42 and Below": "Уровень 42 и Ниже",
  "Level 53 and Below": "Уровень 53 и Ниже",
  "Level 64 and Below": "Уровень 64 и Ниже",
  "No Level Limit": "Без Ограничения Уровня",
  "Guardian of Flame": "Страж Пламени",
  "Monk of Silence": "Монах Безмолвия",
  "Soul Guide": "Проводник Душ",
  Chef: "Повар",
  "Keats Servitor": "Слуга Китса",
  "Head Summoner": "Главный Призыватель",
  "Witness of Dawn": "Свидетель Рассвета",
  "Frontier Guard Captain": "Капитан Пограничной Стражи",
  "GM Helper": "Помощник ГМ",
  "Clan Trader": "Торговец Кланов",
  "Railroad Worker": "Железнодорожный Рабочий",
  "Attribute Master": "Мастер Атрибутов",
  General: "Генерал",
  Weaver: "Ткач",
  "Sharing happiness": "Дарящий Радость",
  "Dwarf Adventurer": "Гном-Авантюрист",
  "Treasure Seeker": "Искатель Сокровищ",
  "Saintess of Elmore-Aden": "Святая Эльмор-Адена",
  "Solina's Guard": "Страж Солины",
  "Library Director of Saints": "Директор Библиотеки Святых",
  King: "Король",
  "Royal Guard Captain": "Капитан Королевской Стражи",
  "Reputation Manager": "Управляющий Репутацией",
  "Jack Game Trainer": "Тренер Игры Джека",
  "Flame Box": "Огненный Ящик",
  "Singer & Dancer Agathion": "Агатион Певец и Танцор",
  "Zakensword Agathion": "Агатион Меч Закена",
  "Cow Agathion": "Агатион Корова",
  "Tow Agathion": "Агатион Тоу",
  "Valentine Messenger": "Посланник Валентина",
  "Soul Healer": "Целитель Душ",
  "Helpless Romantic": "Безнадежный Романтик",
  "Heavenly Envoy": "Небесный Посланник",
  "Character Collector": "Коллекционер Персонажей",
  "Fantasy Isle Warehouse Keeper": "Хранитель Склада Острова Фантазий",
  Invoker: "Заклинатель",
  "Happy Messenger": "Радостный Посланник",
  "Mr. Bashful": "Мистер Застенчивый",
  "Mis-summoned": "Ошибочно Призванный",
  "First Generation Seer": "Провидец Первого Поколения",
  "Kratei's Fortune": "Удача Кратея",
  Lookout: "Наблюдатель",
  "Death-calling": "Взывающий к Смерти",
  "Escort of Ugoros": "Сопровождающий Угороса",
  "Tanta Lizardmen": "Ящеры Танта",
  Crazed: "Обезумевший",
  "Ol Mahum Lord": "Владыка Ол Махум",
  "Naia's Guardian": "Страж Наий",
  Chimera: "Химера",
  "Resistance Commander": "Командир Сопротивления",
  "Torture Expert": "Мастер Пыток",
  "Food of Ekimus": "Пища Экимуса",
  "Tiat's Bodyguard": "Телохранитель Тиата",
  "Grave Guardian Spirit": "Дух Хранителя Могил",
  "Land Dragon's Patroller": "Патрульный Земляного Дракона",
  "Prime Inspector": "Главный Инспектор",
  "Torture Maiden": "Дева Пыток",
  Fire: "Огонь",
  "Steel Citadel": "Стальная Цитадель",
  "Naia's Creature": "Создание Наий",
  "Master Rider": "Мастер Наездник",
  "King of Birds": "Король Птиц",
  "Banshee Queen": "Королева Банши",
  "Deadman of Destruction": "Мертвец Разрушения",
  "Valdstone's Elites": "Элита Валдстоуна",
  "Soul Collector": "Собиратель Душ",
  "Vacuous Soul": "Пустая Душа",
  "Prophet of Lies": "Пророк Лжи",
  "Betrayer of Oblivion": "Предатель Забвения",
  "Wise Retainer of Suffering": "Мудрый Слуга Страданий",
  "Hand of Night": "Рука Ночи",
  Bloodsucker: "Кровопийца",
  "Dark Guardian": "Темный Страж",
  "Soul Destroyer": "Разрушитель Душ",
  "Guide of Darkness": "Проводник Тьмы",
  "Master of Splendor": "Владыка Великолепия",
  Square: "Площадь",
  Flames: "Пламя",
  "Dark Lord": "Темный Владыка",
  "Abyss King": "Король Бездны",
  "Evil Overlord": "Злой Повелитель",
  "Grandis Chief": "Вождь Грандис",
  "Emperor Shunaiman's": "Императора Шунаймана",
  "Fire Dragon": "Огненный Дракон",
  "Gatekeeper of Valakas": "Хранитель Врат Валакаса",
  "Triol's Leader": "Предводитель Триола",
  "Seer of Pagan": "Провидец Пагана",
  "Sealed Evil Power": "Запечатанная Злая Сила",
  "Earth Dragon": "Земляной Дракон",
  "Knight of Destruction": "Рыцарь Разрушения",
  "Lord of Splendor": "Владыка Великолепия",
  "Lord of Immortality": "Владыка Бессмертия",
  "Tiat's Bodyguards": "Телохранители Тиата",
  "Warrior-use Weapon Merchant": "Торговец Оружием для Воинов",
  "Wizard-use Weapon Merchant": "Торговец Оружием для Магов",
  "Wizard-use Armor Merchant": "Торговец Доспехами для Магов",
  "Warrior-use Armor Merchant": "Торговец Доспехами для Воинов",
  "Wizard-use Equipment Merchant": "Торговец Экипировкой для Магов",
  "Sentry Knight": "Рыцарь-Дозорный",
  "Sentinel Knight": "Рыцарь-Часовой",
  "Lighthouse Keeper": "Смотритель Маяка",
  Foreman: "Бригадир",
  "Iron Gate's": "Железных Врат",
  "Golden Wheel's": "Золотого Колеса",
  "Silver Scale's": "Серебряной Чешуи",
  "Bronze Key's": "Бронзового Ключа",
  "Gray Pillar Member": "Член Серой Колонны",
  "Black Anvil's": "Черной Наковальни",
  "Priestess of the Earth": "Жрица Земли",
  Protector: "Защитник",
  "Flame Lord": "Владыка Пламени",
  "Atuba Chief": "Вождь Атуба",
  "Neruga Chief": "Вождь Неруга",
  "Urutu Chief": "Вождь Уруту",
  "Flame Guardian": "Страж Пламени",
  Praetorian: "Преторианец",
  "Partisan Doorman": "Привратник Партизан",
  Astrologer: "Астролог",
  Brother: "Брат",
  "Breka Chief": "Вождь Брека",
  "Enku Chief": "Вождь Энку",
  "Turek Chief": "Вождь Турек",
  "Leunt Chief": "Вождь Леунт",
  "Vuku Chief": "Вождь Вуку",
  Duelist: "Дуэлист",
  Veteran: "Ветеран",
  Sagittarius: "Снайпер",
  Shadow: "Тень",
  Fisher: "Рыбак",
  "High Summoner": "Верховный Призыватель",
  "Duda-Mara Chief": "Вождь Дуда-Мара",
  "Gandi Chief": "Вождь Ганди",
  Champion: "Чемпион",
  Hermit: "Отшельник",
  Wanderer: "Странник",
  Cardinal: "Кардинал",
  Father: "Отец",
  Saint: "Святой",
  Preacher: "Проповедник",
  Chief: "Вождь",
  Jailer: "Тюремщик",
  Militiaman: "Ополченец",
  Guildsman: "Член Гильдии",
  Alchemist: "Алхимик",
  "Fairy of Love": "Фея Любви",
  Fairy: "Фея",
  "Lich King": "Король Личей",
  "Border Outpost Aide": "Помощник Пограничной Заставы",
  "Antique Dealer": "Торговец Древностями",
  "Antique Appraiser": "Оценщик Древностей",
  "Frog Prince": "Принц-Лягушка",
  "Wild Boar Prince": "Принц Вепрей",
  "Orc Prince": "Принц Орков",
  "Prince of Darkness": "Принц Тьмы",
  "Gremlin Prince": "Принц Гремлинов",
  "Prince of Wild Beast": "Принц Диких Зверей",
  "Monster Eye Prince": "Принц Глазастых Монстров",
  "Rabbit Prince": "Принц Кроликов",
  "Human Prince": "Принц Людей",
  Prince: "Принц",
  "Lady Orc": "Леди Орк",
  Locksmith: "Слесарь",
  "Mad Doctor": "Безумный Доктор",
  Leathersmith: "Кожевник",
  "Head Researcher": "Главный Исследователь",
  "Grand Seer": "Великий Провидец",
  Porter: "Носильщик",
  Secretary: "Секретарь",
  "Mother Tree Guardian": "Страж Древа Матери",
  "Tetrarch Agent": "Агент Тетрарха",
  "Tetrarch Executioner": "Палач Тетрарха",
  Deliveryman: "Курьер",
  "Ketra's Messenger": "Посланник Кетра",
  "Varka's Messenger": "Посланник Варка",
  "Town of Gludio": "Город Глудио",
  "Town of Dion": "Город Дион",
  "Town of Giran": "Город Гиран",
  Heine: "Хейн",
  "Town of Oren": "Город Орен",
  "Hunters Village": "Деревня Охотников",
  "Town of Aden": "Город Аден",
  "Town of Goddard": "Город Годдард",
  "Rune Township": "Руна",
  Maid: "Служанка",
  "Beast Herder": "Пастух Зверей",
  "Blacksmith of Flame": "Кузнец Пламени",
  "Valakas Watchman": "Дозорный Валакаса",
  "Mercenary Supplier": "Снабженец Наемников",
  "Mercenary Medic": "Лекарь Наемников",
  "Dark Knight": "Темный Рыцарь",
  Brewer: "Пивовар",
  Gemcutter: "Огранщик",
  "Saint of Light": "Святой Света",
  "Chief Golem Crafter": "Главный Мастер Големов",
  "Golem of Telson": "Голем Телсона",
  "Chief Inspector": "Главный Инспектор",
  "Hunter Guild Member": "Член Гильдии Охотников",
  "Kinsley's Servitor": "Слуга Кинсли",
  "Belinda Servitor": "Слуга Белинды",
  "Cursed Summoner": "Проклятый Призыватель",
  "Master Chef": "Шеф-Повар",
  "Donath Kitchen Help": "Кухонный Помощник Доната",
  "Mist's Granddaughter": "Внучка Мист",
  Nurse: "Медсестра",
  "Retired Adventurer": "Авантюрист в Отставке",
  "Wild Maiden": "Дикая Дева",
  "Runaway Youth": "Беглый Юноша",
  "Beacon Tower Manager": "Смотритель Сигнальной Башни",
  "Blacksmith of Wind": "Кузнец Ветра",
  "Tournament Helper": "Помощник Турнира",
  Zerstorer: "Цершторер",
  Archaeologist: "Археолог",
  "Harbor Caravaner": "Караванщик Гавани",
  "Spirit of the Old Seer": "Дух Старого Провидца",
  "Caravan Merchant": "Караванный Торговец",
  "Wandering Ghost": "Блуждающий Призрак",
  "Love Cat": "Кот Любви",
  "Transformation Wizard": "Маг Превращений",
  Tailor: "Портной",
  "Legendary Blacksmith": "Легендарный Кузнец",
  "Blacksmith of Power": "Кузнец Силы",
  Coordinator: "Координатор",
  "Elf Singer": "Эльфийская Певица",
  "Gatekeeper Welfare Foundation": "Фонд Помощи Хранителям Врат",
  "Life Energy": "Энергия Жизни",
  "Handy's Block Checker - Arena 1": "Проверка Блоков Хэнди - Арена 1",
  "Handy's Block Checker - Arena 2": "Проверка Блоков Хэнди - Арена 2",
  "Handy's Block Checker - Arena 3": "Проверка Блоков Хэнди - Арена 3",
  "Handy's Block Checker - Arena 4": "Проверка Блоков Хэнди - Арена 4",
  Sergeant: "Сержант",
  "Guide of Infinity": "Проводник Бесконечности",
  Artificial: "Искусственный",
  "Gracian Special Product Middleman": "Посредник Особых Товаров Грации",
  "Soul Trader": "Торговец Душами",
  Admiral: "Адмирал",
  "Special Product Broker": "Брокер Особых Товаров",
  Engineer: "Инженер",
  "War Mage": "Боевой Маг",
  "Priest of Shilen": "Жрец Шилен",
  "Herb Collector": "Собиратель Трав",
  "Secret Agent": "Тайный Агент",
  "Great King": "Великий Король",
  Grandma: "Бабушка",
  Native: "Туземец",
  "Captain of the Dawn": "Капитан Рассвета",
  "Emperor of Elmoreden": "Император Эльмордена",
  "Emperor's Guard": "Стража Императора",
  "Password Decoder": "Дешифровщик",
  "Great Teacher": "Великий Учитель",
  "Library of Sages Director": "Директор Библиотеки Мудрецов",
  "Elmore-Aden's": "Эльмор-Адена",
  "Mountain Ascetic": "Горный Отшельник",
  "Birthday Helper": "Помощник Дня Рождения",
  "Game Manager": "Гейм Мастер",
  "Fortune Teller": "Гадалка",
  Wizard: "Волшебник",
  "Energy Recovery Event": "Событие Восстановления Энергии",
  "PC Cafe Event": "Событие PC Кафе",
  "April Fool's Day Event": "Событие Дня Смеха",
  "Bounty Hunter": "Охотник за Головами",
  "Expert Summoner": "Опытный Призыватель",
  "Transport Post": "Транспортный Пост",
  Workman: "Рабочий",
  Apprentice: "Ученик",
  "Grave Robber Leader": "Главарь Расхитителей Могил",
  "Soul Fragment Annex": "Хранилище Осколков Душ",
  "Zaken Researcher": "Исследователь Закена",
  Commander: "Командир",
  "Chief Investigator": "Главный Следователь",
  "Ice Fairy": "Ледяная Фея",
  Transmitter: "Передатчик",
  Director: "Директор",
  "Grand Wizard": "Великий Волшебник",
  "Guide of Revelation": "Проводник Откровения",
  "Warehouse Keeper of the Valley": "Хранитель Склада Долины",
  Herald: "Герольд",
  Duke: "Герцог",
  "Manager of Mercenary": "Управляющий Наемниками",
  "Partisan Herald": "Герольд Партизан",
  "Ol Mahum Steward": "Управляющий Ол Махум",
  Count: "Граф",
  "Farm Manager": "Управляющий Фермой",
  "Pet Trader": "Торговец Питомцами",
};

/**
 * RFC4180-ish reader, same as convert-items-csv.ts's -- npcProperties.csv
 * quotes fields too (titles like "Maitre 'D", names with commas).
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (text[i + 1] === '"') {
        field += '"'; // an escaped quote inside a quoted field
        i++;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Refuses to write a half-translated ru.json. A missing entry would
 * otherwise ship as a silently English title among Russian ones, and a stale
 * one would sit in the table forever after the CSV dropped the npc that used
 * it -- so both directions are errors, the same line the .dat readers hold
 * (see packages/assets-server/scripts/client-data).
 */
function checkCoverage(titles: Set<string>): void {
  const missing = [...titles].filter((title) => !(title in TITLES_RU)).sort();
  if (missing.length > 0) {
    throw new Error(
      `${missing.length} title(s) have no Russian translation -- add them to TITLES_RU:\n  ${missing.join("\n  ")}`
    );
  }

  const unused = Object.keys(TITLES_RU)
    .filter((title) => !titles.has(title))
    .sort();
  if (unused.length > 0) {
    throw new Error(
      `${unused.length} TITLES_RU entr(ies) match no npc in the CSV -- drop them:\n  ${unused.join("\n  ")}`
    );
  }
}

async function main(): Promise<void> {
  const input = process.argv[2] ?? DEFAULT_INPUT;

  let csv: string;
  try {
    csv = await fs.readFile(input, "utf8");
  } catch {
    console.error(
      `No npc CSV at ${input}.\n` +
        `Download it from lineage2ts (cli/overrides/data/csv/npc/npcProperties.csv) to that path, ` +
        `or pass its location as the first argument.`
    );
    process.exitCode = 1;
    return;
  }

  const [header, ...rows] = parseCsv(csv);
  const columnIndex = new Map(header.map((name, index) => [name, index]));
  for (const column of ["id", "title"]) {
    if (!columnIndex.has(column)) {
      throw new Error(`Column "${column}" is missing -- the source CSV's layout changed.`);
    }
  }
  const cell = (row: string[], column: string): string | undefined => row[columnIndex.get(column)!];

  // Untitled npcs are simply left out: two thirds of the table has no title,
  // and an empty string here would cost bytes to say "draw nothing", which is
  // already what a missing key means.
  const en = new Map<number, string>();
  for (const row of rows) {
    if (row.length <= 1) {
      continue; // trailing newline
    }
    const title = cell(row, "title")?.trim();
    if (title) {
      en.set(Number(cell(row, "id")), title);
    }
  }

  checkCoverage(new Set(en.values()));

  // Sorted numerically so regenerating from an updated CSV produces a
  // reviewable diff instead of a reshuffled file.
  const ids = [...en.keys()].sort((a, b) => a - b);
  const enTable: Record<string, string> = {};
  const ruTable: Record<string, string> = {};
  for (const id of ids) {
    enTable[id] = en.get(id)!;
    ruTable[id] = TITLES_RU[en.get(id)!];
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  for (const [lang, table] of [
    ["en", enTable],
    ["ru", ruTable],
  ] as const) {
    const file = path.join(OUTPUT_DIR, `${lang}.json`);
    await fs.writeFile(file, JSON.stringify(table));
    const bytes = (await fs.stat(file)).size;
    console.log(
      `Wrote ${ids.length} titles to ${path.relative(process.cwd(), file)} (${(bytes / 1024).toFixed(0)} KB).`
    );
  }
  console.log(`${Object.keys(TITLES_RU).length} distinct titles across those ${ids.length} npcs.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
