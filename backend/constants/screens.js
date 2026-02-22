const SCREEN_DEFINITIONS = [
    {
        id: 1,
        key: 'select-store',
        label: 'Select Store',
        path: '/select-store',
        group: 'core-operations',
    },
    {
        id: 2,
        key: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        group: 'core-operations',
    },
    {
        id: 3,
        key: 'items',
        label: 'Items',
        path: '/items',
        group: 'catalog-inventory',
    },
    {
        id: 4,
        key: 'billing',
        label: 'Billing',
        path: '/billing',
        group: 'catalog-inventory',
    },
    {
        id: 5,
        key: 'suppliers',
        label: 'Suppliers',
        path: '/suppliers',
        group: 'catalog-inventory',
    },
    {
        id: 6,
        key: 'stores',
        label: 'Stores',
        path: '/stores',
        group: 'catalog-inventory',
    },
    {
        id: 7,
        key: 'purchase-orders',
        label: 'Purchase Orders',
        path: '/purchase-orders',
        group: 'sales-billing',
    },
    {
        id: 8,
        key: 'credits',
        label: 'Credits',
        path: '/credits',
        group: 'sales-billing',
    },
    {
        id: 9,
        key: 'users',
        label: 'Users',
        path: '/users',
        group: 'people-security',
    },
    {
        id: 10,
        key: 'user-rights',
        label: 'Screen Rights',
        path: '/user-rights',
        group: 'people-security',
    },
    {
        id: 11,
        key: 'reports',
        label: 'Reports',
        path: '/reports',
        group: 'core-operations',
    },
];

const canonicalScreens = SCREEN_DEFINITIONS.map((screen) => ({
    ...screen,
    id: Number(screen.id),
    key: screen.key.toLowerCase(),
}));

const SCREEN_KEY_SET = new Set(canonicalScreens.map((screen) => screen.key));
const SCREEN_ID_SET = new Set(canonicalScreens.map((screen) => screen.id));

const SCREEN_ID_TO_SCREEN = canonicalScreens.reduce((acc, screen) => {
    acc[screen.id] = screen;
    acc[String(screen.id)] = screen;
    return acc;
}, {});

const SCREEN_ID_TO_KEY = canonicalScreens.reduce((acc, screen) => {
    acc[screen.id] = screen.key;
    acc[String(screen.id)] = screen.key;
    return acc;
}, {});

const SCREEN_KEY_TO_ID = canonicalScreens.reduce((acc, screen) => {
    acc[screen.key] = screen.id;
    return acc;
}, {});

const normalizeScreenKey = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    const trimmed = String(value).trim();
    if (trimmed === '') {
        return null;
    }

    const lower = trimmed.toLowerCase();
    if (SCREEN_KEY_SET.has(lower)) {
        return lower;
    }

    if (SCREEN_ID_TO_KEY[trimmed]) {
        return SCREEN_ID_TO_KEY[trimmed];
    }

    const numericCandidate = Number(value);
    if (!Number.isNaN(numericCandidate) && SCREEN_ID_TO_KEY[numericCandidate]) {
        return SCREEN_ID_TO_KEY[numericCandidate];
    }

    return null;
};

const normalizeScreenId = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (SCREEN_ID_SET.has(value)) {
        return value;
    }

    const numericCandidate = Number(value);
    if (!Number.isNaN(numericCandidate) && SCREEN_ID_SET.has(numericCandidate)) {
        return numericCandidate;
    }

    const key = normalizeScreenKey(value);
    if (key && SCREEN_KEY_TO_ID[key]) {
        return SCREEN_KEY_TO_ID[key];
    }

    return null;
};

const normalizeScreenIdList = (value, { treatNullAsEmpty = false } = {}) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return treatNullAsEmpty ? [] : undefined;
    }

    let working = value;
    if (typeof working === 'string') {
        const trimmed = working.trim();
        if (trimmed === '') {
            return [];
        }
        working = trimmed.split(',').map((chunk) => chunk.trim()).filter(Boolean);
    } else if (typeof working === 'number') {
        working = [working];
    }

    if (!Array.isArray(working)) {
        return null;
    }

    const normalized = Array.from(
        new Set(
            working
                .map((item) => normalizeScreenId(item))
                .filter((id) => typeof id === 'number')
        )
    );

    return normalized;
};

const serializeScreenIdList = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    const normalized = normalizeScreenIdList(value, { treatNullAsEmpty: true });
    if (normalized === null) {
        return null;
    }
    if (normalized.length === 0) {
        return '';
    }
    return normalized.join(',');
};

const mapScreenIdsToKeys = (ids = []) =>
    Array.isArray(ids)
        ? ids
            .map((id) => SCREEN_ID_TO_KEY[id] || null)
            .filter((key) => typeof key === 'string')
        : [];

export {
    canonicalScreens as SCREEN_DEFINITIONS,
    SCREEN_KEY_SET,
    SCREEN_ID_SET,
    SCREEN_ID_TO_SCREEN,
    SCREEN_ID_TO_KEY,
    SCREEN_KEY_TO_ID,
    normalizeScreenKey,
    normalizeScreenId,
    normalizeScreenIdList,
    serializeScreenIdList,
    mapScreenIdsToKeys,
};


