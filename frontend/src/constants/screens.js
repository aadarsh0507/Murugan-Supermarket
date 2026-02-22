export const SCREEN_GROUPS = [
    {
        id: "core-operations",
        label: "Core Operations",
        description: "High-level store selection and performance views",
        screens: [
            { id: 1, key: "select-store", label: "Select Store", path: "/select-store" },
            { id: 2, key: "dashboard", label: "Dashboard", path: "/dashboard" },
            { id: 11, key: "reports", label: "Reports", path: "/reports" },
        ],
    },
    {
        id: "catalog-inventory",
        label: "Catalog & Inventory",
        description: "Product, category, and vendor masters",
        screens: [
            { id: 3, key: "items", label: "Items", path: "/items" },
            { id: 4, key: "billing", label: "Billing", path: "/billing" },
            { id: 5, key: "suppliers", label: "Suppliers", path: "/suppliers" },
            { id: 6, key: "stores", label: "Stores", path: "/stores" },
        ],
    },
    {
        id: "sales-billing",
        label: "Sales & Billing",
        description: "Sales flow, purchase orders, and credit tracking",
        screens: [
            { id: 7, key: "purchase-orders", label: "Purchase Orders", path: "/purchase-orders" },
            { id: 8, key: "credits", label: "Credits", path: "/credits" },
        ],
    },
    {
        id: "people-security",
        label: "People & Security",
        description: "User administration and access management",
        screens: [
            { id: 9, key: "users", label: "Users", path: "/users" },
            { id: 10, key: "user-rights", label: "Screen Rights", path: "/user-rights" },
        ],
    },
];

export const SCREEN_ORDER = [
    "select-store",
    "dashboard",
    "items",
    "billing",
    "suppliers",
    "stores",
    "purchase-orders",
    "credits",
    "users",
    "user-rights",
    "reports",
];

export const ALL_SCREENS = SCREEN_GROUPS.flatMap((group) => group.screens);
export const ALL_SCREEN_KEYS = ALL_SCREENS.map((screen) => screen.key);
export const ALL_SCREEN_IDS = ALL_SCREENS.map((screen) => screen.id);

export const SCREEN_LOOKUP = ALL_SCREENS.reduce((acc, screen) => {
    acc[screen.key] = screen;
    return acc;
}, {});

export const SCREEN_ID_LOOKUP = ALL_SCREENS.reduce((acc, screen) => {
    acc[screen.id] = screen;
    acc[String(screen.id)] = screen;
    return acc;
}, {});

export const SCREEN_KEY_TO_ID = ALL_SCREENS.reduce((acc, screen) => {
    acc[screen.key] = screen.id;
    return acc;
}, {});

export const SCREEN_ID_TO_KEY = ALL_SCREENS.reduce((acc, screen) => {
    acc[screen.id] = screen.key;
    acc[String(screen.id)] = screen.key;
    return acc;
}, {});

