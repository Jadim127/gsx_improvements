/* Reference data shared by the browser and the server.
 * Issue and category codes are this project's own invented scheme (CAT-NN);
 * they are not taken from any manufacturer's service system. */

export const ISSUE_CATEGORIES = [
  { id: "display",       name: "Display & touch",          code: "DSP" },
  { id: "power",         name: "Power & battery",          code: "PWR" },
  { id: "audio",         name: "Audio",                    code: "AUD" },
  { id: "input",         name: "Buttons & input",          code: "INP" },
  { id: "camera",        name: "Camera",                   code: "CAM" },
  { id: "connectivity",  name: "Wireless & connectivity",  code: "NET" },
  { id: "software",      name: "Software & setup",         code: "SFT" },
  { id: "damage",        name: "Physical & liquid damage", code: "DMG" },
  { id: "accessibility", name: "Accessibility",            code: "ACC" },
  { id: "other",         name: "Other",                    code: "OTH" },
];

// `kinds` limits an issue to certain devices; `accidental` means the limited warranty doesn't cover it.
export const ISSUES = [
  { id: "screen",     category: "display",       code: "DSP-01", name: "Cracked or broken screen", hint: "Cracked glass, lines, dead spots, or no picture", accidental: true },
  { id: "touch",      category: "display",       code: "DSP-02", name: "Touch not responding",     hint: "Taps missed or registered in the wrong place", kinds: ["iphone", "ipad", "watch"] },
  { id: "battery",    category: "power",         code: "PWR-01", name: "Battery problem",          hint: "Drains fast, swollen, or shows a service warning" },
  { id: "power",      category: "power",         code: "PWR-02", name: "Won't turn on",            hint: "No response to power button or charger" },
  { id: "charging",   category: "power",         code: "PWR-03", name: "Won't charge",             hint: "Charges slowly or not at all" },
  { id: "restarts",   category: "power",         code: "PWR-04", name: "Restarts or freezes",      hint: "Unexpected shutdowns, reboots, or hangs" },
  { id: "audio",      category: "audio",         code: "AUD-01", name: "Speaker or microphone",    hint: "No sound, crackling, or callers can't hear" },
  { id: "keyboard",   category: "input",         code: "INP-01", name: "Keyboard or trackpad",     hint: "Keys stick, repeat, or don't respond", kinds: ["mac"] },
  { id: "buttons",    category: "input",         code: "INP-02", name: "Buttons not working",      hint: "Side, volume, or crown buttons", kinds: ["iphone", "ipad", "watch"] },
  { id: "camera",     category: "camera",        code: "CAM-01", name: "Camera problem",           hint: "Blurry, black, or app won't open", kinds: ["iphone", "ipad"] },
  { id: "wireless",   category: "connectivity",  code: "NET-01", name: "Wi-Fi or Bluetooth",       hint: "Can't connect, or keeps dropping" },
  { id: "cellular",   category: "connectivity",  code: "NET-02", name: "No cellular service",      hint: "No signal or SIM not detected", kinds: ["iphone"] },
  { id: "update",     category: "software",      code: "SFT-01", name: "Update or restore failed", hint: "Stuck during an update or restore" },
  { id: "setup",      category: "software",      code: "SFT-02", name: "Setup or data transfer",   hint: "Problems setting up or moving data from another device" },
  { id: "liquid",     category: "damage",        code: "DMG-01", name: "Liquid damage",            hint: "Was exposed to water or another liquid", accidental: true },
  { id: "acc-vision", category: "accessibility", code: "ACC-01", name: "Vision features",          hint: "Screen reader, zoom, or display accommodations" },
  { id: "acc-hearing",category: "accessibility", code: "ACC-02", name: "Hearing features",         hint: "Hearing devices, captions, or audio accommodations" },
  { id: "acc-motor",  category: "accessibility", code: "ACC-03", name: "Physical & motor features", hint: "Switch control, touch accommodations, or voice control" },
  { id: "acc-speech", category: "accessibility", code: "ACC-04", name: "Speech features",          hint: "Live speech or speech recognition" },
  { id: "other",      category: "other",         code: "OTH-01", name: "Something else",           hint: "Describe the problem in the notes" },
];

// Suggested parts per device kind and issue, as { name, price } (full price in USD).
const part = (name, price) => ({ name, price });
const unit = (price) => [part("Whole-unit replacement", price)];

export const PARTS = {
  mac: {
    screen:   [part("Display assembly", 599)],
    battery:  [part("Battery with top case", 249)],
    power:    [part("Logic board", 749)],
    charging: [part("USB-C port board", 129)],
    liquid:   [part("Logic board", 749), part("Top case with keyboard", 349)],
    audio:    [part("Speaker set", 89)],
    keyboard: [part("Top case with keyboard", 349)],
  },
  iphone: {
    screen:   [part("Display", 329)],
    touch:    [part("Display", 329)],
    battery:  [part("Battery", 99)],
    power:    unit(549),
    charging: [part("Charging port assembly", 119)],
    liquid:   unit(549),
    camera:   [part("Rear camera module", 169)],
    audio:    [part("Bottom speaker", 79)],
    buttons:  [part("Side button flex", 69)],
  },
  ipad: {
    screen:   unit(399),
    touch:    unit(399),
    battery:  [part("Battery service (unit swap)", 199)],
    power:    unit(399),
    charging: unit(399),
    liquid:   unit(399),
    camera:   unit(399),
    audio:    unit(399),
    buttons:  unit(399),
  },
  watch: {
    screen:   unit(299),
    touch:    unit(299),
    battery:  [part("Battery service (unit swap)", 99)],
    power:    unit(299),
    charging: unit(299),
    liquid:   unit(299),
    audio:    unit(299),
    buttons:  unit(299),
  },
};

export const REPAIR_TYPES = [
  { id: "carry-in", name: "Fix it here", sub: "Carry-in", desc: "Customer leaves the device with you and you repair it in the store. Usually 1–3 days." },
  { id: "mail-in",  name: "Send it out", sub: "Mail-in",  desc: "Ship the device to a partner repair center. Usually 5–7 business days." },
  { id: "swap",     name: "Swap the whole unit", sub: "Whole-unit replacement", desc: "Give the customer a replacement unit and return the old one." },
];

// Status pipeline, in order. `next` is the button label that moves a repair forward.
export const STATUSES = [
  { id: "open",   name: "Checked in",       tone: "info", next: "Order parts",                  help: "Parts haven't been ordered yet." },
  { id: "parts",  name: "Waiting on parts", tone: "warn", next: "Parts arrived — start repair", help: "Parts are on the way." },
  { id: "repair", name: "In repair",        tone: "info", next: "Mark repair done",             help: "A technician is working on it." },
  { id: "pickup", name: "Ready for pickup", tone: "good", next: "Customer picked it up",        help: "Let the customer know it's ready." },
  { id: "closed", name: "Closed",           tone: "",     next: null,                           help: "This repair is finished." },
];

export const RETURN_WINDOW_DAYS = 15;

export const issueById = (id) => ISSUES.find((i) => i.id === id);
export const typeById = (id) => REPAIR_TYPES.find((t) => t.id === id);
export const issuesFor = (kind) => ISSUES.filter((i) => !i.kinds || i.kinds.includes(kind));
export const suggestedParts = (kind, issueId) => PARTS[kind]?.[issueId] ?? [];
