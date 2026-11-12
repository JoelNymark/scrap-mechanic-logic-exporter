export const COMPONENTS = [
    { type: 'AND', color: 'bg-blue-500', mode: 0, category: 'gate' },
    { type: 'OR', color: 'bg-green-500', mode: 1, category: 'gate' },
    { type: 'XOR', color: 'bg-purple-500', mode: 2, category: 'gate' },
    { type: 'NAND', color: 'bg-red-500', mode: 3, category: 'gate' },
    { type: 'NOR', color: 'bg-orange-500', mode: 4, category: 'gate' },
    { type: 'XNOR', color: 'bg-pink-500', mode: 5, category: 'gate' },

    { type: 'SWITCH', color: 'bg-yellow-600', category: 'interactable', shapeId: "7cf717d7-d167-4f2d-a6e7-6b2c70aa3986" },
    { type: 'BUTTON', color: 'bg-yellow-500', category: 'interactable', shapeId: "1e8d93a4-506b-470d-9ada-9c0a321e2db5" },
    { type: 'TIMER', color: 'bg-teal-500', category: 'interactable', shapeId: "8f7fd0e7-c46e-4944-a414-7ce2437bb30f", w: 2 },
];

export const PALETTE = [
    { tw: 'bg-red-500', hex: 'ef4444' },
    { tw: 'bg-orange-500', hex: 'f97316' },
    { tw: 'bg-yellow-500', hex: 'eab308' },
    { tw: 'bg-green-500', hex: '22c55e' },
    { tw: 'bg-teal-500', hex: '14b8a6' },
    { tw: 'bg-blue-500', hex: '3b82f6' },
    { tw: 'bg-purple-500', hex: 'a855f7' },
    { tw: 'bg-pink-500', hex: 'ec4899' },
    { tw: 'bg-gray-400', hex: '9ca3af' },
    { tw: 'bg-gray-800', hex: '1f2937' },
];

export const GRID_SIZE = 80;