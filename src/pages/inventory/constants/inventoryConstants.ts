// Constants for inventory

export const ITEMS_PER_PAGE = 50;

export const HSN_GST_MAPPING: { [key: string]: number } = {
    '0401': 0,   // Milk and cream
    '0402': 5,   // Milk powder
    '1001': 0,   // Wheat
    '1006': 0,   // Rice
    '1701': 5,   // Sugar
    '2106': 12,  // Food preparations
    '3004': 12,  // Medicaments
    '6109': 5,   // T-shirts
    '6203': 5,   // Men's suits
    '6204': 5,   // Women's suits
    '8471': 18,  // Computers
    '8517': 18,  // Phones
    '8528': 28,  // Monitors/TVs
    '8703': 28,  // Motor cars
    '9403': 18,  // Furniture
};

export const GST_RATES = [0, 5, 12, 18, 28];

export const DEFAULT_GST_RATE = 18;

