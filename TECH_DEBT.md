# Tech Debt

Technical debt items identified during code reviews that should be addressed in future iterations.

## High Priority

### Triplicate AppSettings Type Definition

**Location:**

- `apps/desktop/src/main/settings.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/src/hooks/useSettings.ts`

**Problem:** The `AppSettings` interface is manually duplicated across the main process, preload script, and renderer. When adding new settings (e.g., calendar settings), all three files must be updated manually.

**Impact:** Maintenance burden, risk of type drift between processes.

**Suggested Fix:** Create a shared types package or use a build-time code generation approach to ensure type consistency across Electron's process boundary.

---

## Medium Priority

### Copy-Paste Update Wrappers in useSettings

**Location:** `apps/desktop/src/renderer/src/hooks/useSettings.ts` (lines 75-123)

**Problem:** Five nearly-identical update functions (`updateTranscription`, `updateAudio`, `updateUI`, `updateApp`, `updateCalendar`) follow the same pattern:

```typescript
const updateX = useCallback(
  async (updates: Partial<AppSettings["x"]>) => {
    if (!settings) return false;
    return updateSettings({
      x: { ...settings.x, ...updates },
    });
  },
  [settings, updateSettings]
);
```

**Impact:** Adding a new settings category requires duplicating the pattern again.

**Suggested Fix:** Create a factory function:

```typescript
const createSettingsUpdater = <K extends keyof AppSettings>(key: K) =>
  useCallback(
    async (updates: Partial<AppSettings[K]>) => {
      if (!settings) return false;
      return updateSettings({ [key]: { ...settings[key], ...updates } });
    },
    [settings, updateSettings]
  );
```

---

## Low Priority

### Magic Navigation Strings

**Location:** `apps/desktop/src/renderer/src/App.tsx` (lines 60-66)

**Problem:** Navigation relies on hardcoded string paths like `"/settings"`. No constants defined for navigation routes.

**Suggested Fix:** Define route constants in a shared location.

---

### SettingsSectionId Manual Sync

**Location:**

- `apps/desktop/src/renderer/src/components/settings-config.ts`
- `apps/desktop/src/renderer/src/App.tsx`

**Problem:** `SettingsSectionId` is a union type, and `settingsSidebarItems` array must be manually kept in sync. Adding a new section requires updating both.

**Suggested Fix:** Use `as const` with a lookup object to derive the type from the data:

```typescript
const SETTINGS_SECTIONS = {
  account: { label: "...", icon: UserRound, description: "..." },
  calendar: { ... },
  permissions: { ... },
} as const;

type SettingsSectionId = keyof typeof SETTINGS_SECTIONS;
```
