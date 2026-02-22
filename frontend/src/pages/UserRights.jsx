import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    BadgeCheck,
    CheckSquare,
    Loader2,
    ShieldCheck,
    UserSearch,
    UsersRound,
    RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { usersAPI, screensAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
    SCREEN_LOOKUP,
    SCREEN_ID_LOOKUP,
    SCREEN_ORDER,
} from "@/constants/screens";
import { useAuth } from "@/contexts/AuthContext";

const ORDERED_SCREENS = SCREEN_ORDER.map((key) => SCREEN_LOOKUP[key]).filter(Boolean);
const SCREEN_ORDER_INDEX = SCREEN_ORDER.reduce((acc, key, index) => {
    acc[key] = index;
    return acc;
}, {});
const DEFAULT_SCREEN_IDS = ORDERED_SCREENS.map((screen) => screen.id);

const normalizeRawScreenValues = (value) => {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch {
            // ignore json parse errors
        }
        return trimmed
            .split(/[,|\s]+/)
            .map((token) => token.trim())
            .filter(Boolean);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return [value];
    }
    if (value === null || value === undefined) {
        return [];
    }
    return [];
};

const sanitizeScreenIds = (values) => {
    if (!Array.isArray(values)) return undefined;
    const unique = Array.from(
        new Set(
            values
                .map((value) => {
                    if (value === null || value === undefined) return null;
                    if (SCREEN_ID_LOOKUP[value]) {
                        return SCREEN_ID_LOOKUP[value].id;
                    }
                    const asNumber = Number(value);
                    if (!Number.isNaN(asNumber) && SCREEN_ID_LOOKUP[asNumber]) {
                        return SCREEN_ID_LOOKUP[asNumber].id;
                    }
                    if (typeof value === "string") {
                        const trimmed = value.trim();
                        if (trimmed && SCREEN_ID_LOOKUP[trimmed]) {
                            return SCREEN_ID_LOOKUP[trimmed].id;
                        }
                        const lookup = SCREEN_LOOKUP[trimmed];
                        if (lookup) return lookup.id;
                    }
                    return null;
                })
                .filter((id) => id !== null)
        )
    );
    return unique.length > 0 ? unique : [];
};

const extractUserScreenIds = (user) => {
    if (!user) return [];
    const candidates = [
        user.screenIds,
        user.screenRights,
        user.screen_id,
        user.screenId,
        user.screen_ids,
    ];
    for (const candidate of candidates) {
        if (candidate !== undefined) {
            return normalizeRawScreenValues(candidate);
        }
    }
    return [];
};

const areSetsEqual = (setA, setB) => {
    if (setA.size !== setB.size) return false;
    for (const value of setA) {
        if (!setB.has(value)) return false;
    }
    return true;
};

const formatUserName = (user) => {
    const first = user?.firstName?.toString().trim() || "";
    const last = user?.lastName?.toString().trim() || "";
    if (first && last) return `${first} ${last}`;
    return first || last || user?.email || "Unnamed User";
};

export default function UserRights() {
    const { toast } = useToast();
    const { user: authUser, refreshUser } = useAuth();

    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [availableScreens, setAvailableScreens] = useState(ORDERED_SCREENS);
    const [selectedScreenIds, setSelectedScreenIds] = useState(
        new Set(DEFAULT_SCREEN_IDS)
    );
    const [originalScreenIds, setOriginalScreenIds] = useState(
        new Set(DEFAULT_SCREEN_IDS)
    );
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingScreens, setLoadingScreens] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userRightsMap, setUserRightsMap] = useState({});
    const [editRightsMap, setEditRightsMap] = useState({});
    const [selectedEditRights, setSelectedEditRights] = useState(new Set());
    const [originalEditRights, setOriginalEditRights] = useState(new Set());

    const activeScreens = useMemo(
        () => availableScreens.filter((screen) => screen?.isActive !== false),
        [availableScreens]
    );

    const visibleScreenIds = useMemo(
        () => activeScreens.map((screen) => screen.id),
        [activeScreens]
    );

    const totalScreens = visibleScreenIds.length;
    const selectedCount = selectedScreenIds.size;

    useEffect(() => {
        const fetchScreens = async () => {
            setLoadingScreens(true);
            try {
                const response = await screensAPI.getScreens();
                const rawScreens = response?.data?.screens ?? response?.screens ?? [];
                const normalized =
                    rawScreens
                        .map((screen) => {
                            const key = screen.screenKey ?? SCREEN_ID_LOOKUP[screen.id]?.key;
                            if (!key) return null;
                            const matched = SCREEN_LOOKUP[key] ?? SCREEN_ID_LOOKUP[screen.id];
                            return {
                                ...(matched ?? {}),
                                id: matched?.id ?? screen.id,
                                key,
                                label: screen.screenName || matched?.label || key,
                                path: matched?.path ?? screen.path ?? `/${key}`,
                                isActive: screen.isActive !== false,
                            };
                        })
                        .filter(Boolean)
                        .sort((a, b) => {
                            const orderA = SCREEN_ORDER_INDEX[a.key] ?? Number.MAX_SAFE_INTEGER;
                            const orderB = SCREEN_ORDER_INDEX[b.key] ?? Number.MAX_SAFE_INTEGER;
                            return orderA - orderB;
                        }) || [];

                const hydrated = normalized.length > 0 ? normalized : ORDERED_SCREENS;
                const allowedIds = new Set(hydrated.map((screen) => screen.id));

                setAvailableScreens(hydrated);
                setSelectedScreenIds((prev) => {
                    const filtered = new Set(
                        Array.from(prev).filter((id) => allowedIds.has(id))
                    );
                    return filtered.size > 0 ? filtered : new Set(allowedIds);
                });
                setOriginalScreenIds((prev) => {
                    const filtered = new Set(
                        Array.from(prev).filter((id) => allowedIds.has(id))
                    );
                    return filtered.size > 0 ? filtered : new Set(allowedIds);
                });
            } catch (error) {
                console.error("Failed to load screens", error);
                toast({
                    title: "Unable to load screens",
                    description: "Using default screen definitions.",
                    variant: "destructive",
                });
                setAvailableScreens(ORDERED_SCREENS);
                setSelectedScreenIds(new Set(DEFAULT_SCREEN_IDS));
                setOriginalScreenIds(new Set(DEFAULT_SCREEN_IDS));
            } finally {
                setLoadingScreens(false);
            }
        };

        fetchScreens();
    }, [toast]);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoadingUsers(true);
            try {
                const response = await usersAPI.getUsers();
                const rawList = response?.data?.users ?? [];
                // Filter out push diggy user
                const list = rawList.filter((user) => {
                    const email = (user?.email || "").toString().trim().toLowerCase();
                    return email !== "pushdiggy@gmail.com";
                });
                setUsers(list);
                const rights = list.reduce((acc, user) => {
                    const id = String(user?._id ?? user?.id ?? "");
                    if (!id) return acc;
                    const rawValues = extractUserScreenIds(user);
                    const normalizedIds = sanitizeScreenIds(rawValues);
                    acc[id] = Array.isArray(normalizedIds) ? normalizedIds : [];
                    return acc;
                }, {});
                setUserRightsMap(rights);
                
                // Extract edit rights
                const editRights = list.reduce((acc, user) => {
                    const id = String(user?._id ?? user?.id ?? "");
                    if (!id) return acc;
                    const editRightsArray = user?.editRights;
                    acc[id] = Array.isArray(editRightsArray) ? editRightsArray : [];
                    return acc;
                }, {});
                setEditRightsMap(editRights);
            } catch (error) {
                console.error("Failed to load users", error);
                toast({
                    title: "Unable to load users",
                    description: "Please refresh the page or try again later.",
                    variant: "destructive",
                });
            } finally {
                setLoadingUsers(false);
            }
        };

        fetchUsers();
    }, [toast]);

    const selectedUser = useMemo(
        () =>
            users.find((candidate) => {
                const id = candidate?._id ?? candidate?.id;
                return id && String(id) === selectedUserId;
            }),
        [users, selectedUserId]
    );
    const selectedUserIsAdmin = useMemo(
        () => Boolean(selectedUser?.isAdmin ?? selectedUser?.is_admin),
        [selectedUser]
    );

    const hasChanges =
        Boolean(selectedUserId) &&
        !selectedUserIsAdmin &&
        (!areSetsEqual(selectedScreenIds, originalScreenIds) ||
         !areSetsEqual(selectedEditRights, originalEditRights));

    useEffect(() => {
        if (!selectedUserIsAdmin) {
            return;
        }
        const fullSet = new Set(visibleScreenIds);
        if (!areSetsEqual(selectedScreenIds, fullSet)) {
            setSelectedScreenIds(fullSet);
        }
        if (!areSetsEqual(originalScreenIds, fullSet)) {
            setOriginalScreenIds(new Set(fullSet));
        }
        if (!areSetsEqual(selectedEditRights, fullSet)) {
            setSelectedEditRights(fullSet);
        }
        if (!areSetsEqual(originalEditRights, fullSet)) {
            setOriginalEditRights(new Set(fullSet));
        }
    }, [selectedUserIsAdmin, visibleScreenIds, selectedScreenIds, originalScreenIds, selectedEditRights, originalEditRights]);

    const handleSelectUser = async (userId) => {
        setSelectedUserId(userId);
        const targetUser = users.find((candidate) => {
            const id = candidate?._id ?? candidate?.id;
            return id && String(id) === userId;
        });
        const userIsAdmin = Boolean(targetUser?.isAdmin ?? targetUser?.is_admin);
        if (userIsAdmin) {
            const fullSet = new Set(visibleScreenIds);
            setSelectedScreenIds(fullSet);
            setOriginalScreenIds(new Set(fullSet));
            // Admins have edit rights for all screens
            setSelectedEditRights(new Set(visibleScreenIds));
            setOriginalEditRights(new Set(visibleScreenIds));
            return;
        }
        const rightsArray = userRightsMap[userId];
        if (Array.isArray(rightsArray)) {
            const validIds = rightsArray.filter((id) =>
                visibleScreenIds.includes(id)
            );
            const nextSet = new Set(validIds);
            setSelectedScreenIds(nextSet);
            setOriginalScreenIds(new Set(nextSet));
        } else {
            const emptySet = new Set();
            setSelectedScreenIds(emptySet);
            setOriginalScreenIds(new Set(emptySet));
        }
        
        // Load edit rights for the user
        const editRightsArray = editRightsMap[userId];
        if (Array.isArray(editRightsArray)) {
            const validEditIds = editRightsArray.filter((id) =>
                visibleScreenIds.includes(id)
            );
            setSelectedEditRights(new Set(validEditIds));
            setOriginalEditRights(new Set(validEditIds));
        } else {
            setSelectedEditRights(new Set());
            setOriginalEditRights(new Set());
        }
    };

    const toggleScreen = (screenId, isChecked) => {
        if (selectedUserIsAdmin) {
            return;
        }
        setSelectedScreenIds((prev) => {
            const next = new Set(prev);
            if (isChecked) {
                next.add(screenId);
            } else {
                next.delete(screenId);
                // If screen access is removed, also remove edit right
                setSelectedEditRights((prevEdit) => {
                    const nextEdit = new Set(prevEdit);
                    nextEdit.delete(screenId);
                    return nextEdit;
                });
            }
            return next;
        });
    };

    const toggleEditRight = (screenId, isChecked) => {
        if (selectedUserIsAdmin) {
            return;
        }
        // Only allow edit right if screen access is granted
        if (!selectedScreenIds.has(screenId)) {
            return;
        }
        setSelectedEditRights((prev) => {
            const next = new Set(prev);
            if (isChecked) {
                next.add(screenId);
            } else {
                next.delete(screenId);
            }
            return next;
        });
    };

    const setAllScreens = (shouldSelect) => {
        if (selectedUserIsAdmin) {
            return;
        }
        setSelectedScreenIds(shouldSelect ? new Set(visibleScreenIds) : new Set());
    };

    const handleReset = () => {
        if (selectedUserIsAdmin) {
            return;
        }
        setSelectedScreenIds(new Set(originalScreenIds));
        setSelectedEditRights(new Set(originalEditRights));
    };

    const handleSave = async () => {
        if (!selectedUserId) return;
        if (selectedUserIsAdmin) return;
        try {
            setSaving(true);
            const payload = {
                screens: Array.from(selectedScreenIds).sort((a, b) => {
                    const keyA = SCREEN_ID_LOOKUP[a]?.key;
                    const keyB = SCREEN_ID_LOOKUP[b]?.key;
                    const orderA = keyA ? SCREEN_ORDER_INDEX[keyA] ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
                    const orderB = keyB ? SCREEN_ORDER_INDEX[keyB] ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
                    return orderA - orderB;
                }),
                editRights: Array.from(selectedEditRights).sort((a, b) => {
                    const keyA = SCREEN_ID_LOOKUP[a]?.key;
                    const keyB = SCREEN_ID_LOOKUP[b]?.key;
                    const orderA = keyA ? SCREEN_ORDER_INDEX[keyA] ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
                    const orderB = keyB ? SCREEN_ORDER_INDEX[keyB] ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
                    return orderA - orderB;
                }),
            };
            await usersAPI.updateUser(selectedUserId, payload);
            setOriginalScreenIds(new Set(selectedScreenIds));
            setOriginalEditRights(new Set(selectedEditRights));
            setUserRightsMap((prev) => ({
                ...prev,
                [selectedUserId]: payload.screens,
            }));
            setEditRightsMap((prev) => ({
                ...prev,
                [selectedUserId]: payload.editRights,
            }));
            toast({
                title: "Screen rights saved",
                description: "The user will only see the selected screens.",
            });

            if (String(authUser?._id ?? authUser?.id) === selectedUserId) {
                await refreshUser();
            }
        } catch (error) {
            console.error("Unable to save screen rights", error);
            toast({
                title: "Save failed",
                description: "We couldn't persist the screen permissions.",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const selectionBadgeVariant = selectedUserIsAdmin
        ? "default"
        : selectedCount === totalScreens
            ? "default"
            : selectedCount === 0
                ? "outline"
                : "secondary";

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center justify-between gap-4"
            >
                <div>
                    <p className="text-sm font-semibold text-primary uppercase tracking-wide">
                        Screen Rights
                    </p>
                    <h1 className="text-3xl font-bold text-foreground">
                        Assign Application Access
                    </h1>
                    <p className="text-muted-foreground max-w-3xl">
                        Pick a user, tick the screens they can see, and enforce the same
                        rules across menus and direct URLs. The matrix below mirrors every
                        protected page in the app.
                    </p>
                </div>
                <Badge variant="outline" className="text-sm">
                    {totalScreens} total screens mapped
                </Badge>
            </motion.div>

            <Card className="border-2 border-dashed">
                <CardHeader>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <UsersRound className="h-5 w-5 text-primary" />
                                Choose a user to manage
                            </CardTitle>
                            <CardDescription>
                                Search by name or email and instantly load their current
                                screen set.
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => setAllScreens(true)}
                                disabled={!selectedUserId || selectedUserIsAdmin}
                            >
                                <CheckSquare className="h-4 w-4" />
                                Select all
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => setAllScreens(false)}
                                disabled={!selectedUserId || selectedUserIsAdmin}
                            >
                                <ShieldCheck className="h-4 w-4" />
                                Clear all
                            </Button>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <UserSearch className="h-4 w-4 text-muted-foreground" />
                                Select user
                            </label>
                            <Select
                                value={selectedUserId}
                                onValueChange={handleSelectUser}
                                disabled={loadingUsers}
                            >
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder={loadingUsers ? "Loading users..." : "Pick a user"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map((user) => {
                                        const id = String(user?._id ?? user?.id);
                                        const isAdmin = Boolean(user?.isAdmin ?? user?.is_admin);
                                        return (
                                            <SelectItem key={id} value={id}>
                                                <span className="flex flex-col">
                                                    <span>
                                                        {formatUserName(user)} • {user?.email || "No email"}
                                                    </span>
                                                    {isAdmin && (
                                                        <span className="text-xs text-primary">
                                                            Admin access
                                                        </span>
                                                    )}
                                                </span>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="rounded-xl border bg-muted/30 p-4">
                            <p className="text-xs uppercase text-muted-foreground tracking-wide">
                                Selection summary
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                                {selectedCount} / {totalScreens}
                                <Badge variant={selectionBadgeVariant} className="ml-auto">
                                    {selectedUserIsAdmin
                                        ? "Admin"
                                        : selectedCount === totalScreens
                                            ? "Full access"
                                            : selectedCount === 0
                                                ? "No access"
                                                : "Custom"}
                                </Badge>
                            </div>
                            {selectedUser && (
                                <p className="text-xs mt-2 text-muted-foreground">
                                    Editing rights for{" "}
                                    <span className="font-medium text-foreground">
                                        {formatUserName(selectedUser)}
                                    </span>
                                    {selectedUserIsAdmin && (
                                        <span className="ml-1 text-primary font-semibold">
                                            (Admin)
                                        </span>
                                    )}
                                </p>
                            )}
                            {selectedUserIsAdmin && (
                                <p className="text-xs mt-2 text-muted-foreground">
                                    Admin users inherit every screen automatically. To limit access,
                                    switch off admin privileges from the Users page.
                                </p>
                            )}
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {!selectedUserId ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                            <ShieldCheck className="h-10 w-10 text-muted-foreground" />
                            <div>
                                <p className="text-lg font-semibold">No user selected yet</p>
                                <p className="text-sm text-muted-foreground">
                                    Pick an employee to view and edit their screen-level access.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border bg-card shadow-sm">
                            <div className="flex items-center justify-between border-b px-5 py-4">
                                <div>
                                    <p className="font-semibold">Screen list</p>
                                    <p className="text-sm text-muted-foreground">
                                        Toggle the modules exactly as shown in the reference view.
                                    </p>
                                </div>
                                <Badge variant="secondary">{totalScreens} entries</Badge>
                            </div>
                            {loadingScreens ? (
                                <div className="flex items-center justify-center gap-3 py-10">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">
                                        Loading screens...
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {selectedUserIsAdmin && (
                                        <div className="mx-5 mb-4 flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                                            <ShieldCheck className="h-5 w-5 text-primary" />
                                            <div>
                                                <p className="font-semibold text-foreground">
                                                    Admin access enabled
                                                </p>
                                                <p>
                                                    Screen toggles are disabled because this user already has access to every screen.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <ScrollArea className="max-h-[540px]">
                                        <ul className="space-y-1 p-5">
                                            {activeScreens.map((screen) => (
                                                <li
                                                    key={screen.key}
                                                    className="flex items-center gap-3 rounded-md px-2 py-1 text-sm transition hover:bg-muted/50"
                                                >
                                                    <span className="text-muted-foreground">•</span>
                                                    <Checkbox
                                                        checked={selectedScreenIds.has(screen.id)}
                                                        onCheckedChange={(value) =>
                                                            toggleScreen(screen.id, value === true)
                                                        }
                                                        id={`screen-${screen.key}`}
                                                        disabled={selectedUserIsAdmin}
                                                    />
                                                    <label
                                                        htmlFor={`screen-${screen.key}`}
                                                        className="cursor-pointer select-none font-medium flex-1"
                                                    >
                                                        {screen.label}
                                                    </label>
                                                    {selectedScreenIds.has(screen.id) && (
                                                        <div className="flex items-center gap-2">
                                                            <Label htmlFor={`edit-${screen.key}`} className="text-xs text-muted-foreground">
                                                                Edit
                                                            </Label>
                                                            <Switch
                                                                id={`edit-${screen.key}`}
                                                                checked={selectedEditRights.has(screen.id)}
                                                                onCheckedChange={(checked) =>
                                                                    toggleEditRight(screen.id, checked)
                                                                }
                                                                disabled={selectedUserIsAdmin || !selectedScreenIds.has(screen.id)}
                                                            />
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </ScrollArea>
                                </>
                            )}
                        </div>
                    )}
                </CardContent>

                <CardContent className="flex flex-col gap-3 border-t bg-muted/20 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BadgeCheck className="h-4 w-4 text-primary" />
                        Enforced in sidebar, quick links, and route guards.
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            variant="ghost"
                            className="gap-2"
                            onClick={handleReset}
                            disabled={!hasChanges || selectedUserIsAdmin}
                        >
                            <RefreshCw className="h-4 w-4" />
                            Reset changes
                        </Button>
                        <Button
                            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={handleSave}
                            disabled={!hasChanges || saving || selectedUserIsAdmin}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="h-4 w-4" />
                                    Save rights
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

