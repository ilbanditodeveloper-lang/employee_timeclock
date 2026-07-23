import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import type { DaySchedule, WeekSchedule } from "@shared/scheduleDefaults";
import {
  getScheduleDayMode,
  setScheduleDayActive,
  setScheduleDayMode,
  setScheduleDayTime,
  type ScheduleDayMode,
} from "@shared/scheduleEditor";

type WeekdayKey = keyof WeekSchedule;

type ScheduleDayOption = {
  key: WeekdayKey;
  label: string;
};

type EmployeeWeekScheduleEditorProps = {
  schedule: WeekSchedule;
  onChange: (schedule: WeekSchedule) => void;
  scheduleDays: readonly ScheduleDayOption[];
  layout?: "form" | "grid";
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function parseTime(value: string) {
  if (!value) return { hour: "", minute: "" };
  const [hour, minute] = value.split(":");
  return { hour: hour || "", minute: minute || "" };
}

function buildTime(hour: string, minute: string) {
  if (!hour && !minute) return "";
  return `${hour || "00"}:${minute || "00"}`;
}

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  idPrefix: string;
};

function ScheduleTimePicker({ value, onChange, onClear, idPrefix }: TimePickerProps) {
  const { t } = useLocale();
  const time = parseTime(value);

  const update = (hour: string, minute: string) => {
    onChange(buildTime(hour, minute));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        id={`${idPrefix}-hour`}
        className="input-elegant min-w-[4.5rem]"
        value={time.hour}
        onChange={(e) => update(e.target.value, time.minute)}
      >
        <option value="">HH</option>
        {HOUR_OPTIONS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground">:</span>
      <select
        id={`${idPrefix}-minute`}
        className="input-elegant min-w-[4.5rem]"
        value={time.minute}
        onChange={(e) => update(time.hour, e.target.value)}
      >
        <option value="">MM</option>
        {MINUTE_OPTIONS.map((minute) => (
          <option key={minute} value={minute}>
            {minute}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" variant="ghost" onClick={onClear}>
        {t("common.clear")}
      </Button>
    </div>
  );
}

type DayEditorProps = {
  dayKey: WeekdayKey;
  dayLabel: string;
  day: DaySchedule;
  mode: ScheduleDayMode;
  onDayChange: (day: DaySchedule) => void;
  onModeChange: (mode: ScheduleDayMode) => void;
  compact?: boolean;
};

function ScheduleDayEditor({
  dayKey,
  dayLabel,
  day,
  mode,
  onDayChange,
  onModeChange,
  compact,
}: DayEditorProps) {
  const { t } = useLocale();
  const idBase = `schedule-${dayKey}`;

  const setMode = (nextMode: ScheduleDayMode) => {
    onModeChange(nextMode);
    onDayChange(setScheduleDayMode(day, nextMode));
  };

  const setTime = (field: "entry1" | "entry2" | "exit1" | "exit2", value: string) => {
    onDayChange(setScheduleDayTime(day, field, value));
  };

  if (!day.isActive) {
    return (
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-foreground">{dayLabel}</p>
          <label className="flex items-center gap-2 text-sm text-foreground shrink-0">
            <input
              type="checkbox"
              checked={false}
              onChange={() => onDayChange(setScheduleDayActive(day, true))}
            />
            {t("admin.schedule.workDay")}
          </label>
        </div>
        <p className="text-sm text-muted-foreground">{t("common.shiftTypes.off")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium text-foreground">{dayLabel}</p>
        <label className="flex items-center gap-2 text-sm text-foreground shrink-0">
          <input
            type="checkbox"
            checked={day.isActive}
            onChange={(e) => onDayChange(setScheduleDayActive(day, e.target.checked))}
          />
          {t("admin.schedule.workDay")}
        </label>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("admin.schedule.modeLabel")}</Label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`${idBase}-mode`}
              checked={mode === "continuous"}
              onChange={() => setMode("continuous")}
            />
            {t("admin.schedule.modeContinuous")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`${idBase}-mode`}
              checked={mode === "split"}
              onChange={() => setMode("split")}
            />
            {t("admin.schedule.modeSplit")}
          </label>
        </div>
      </div>

      {mode === "continuous" ? (
        <div className={compact ? "space-y-3" : "grid gap-4 sm:grid-cols-2"}>
          <div className="space-y-2">
            <Label className="text-xs">{t("admin.schedule.entry")}</Label>
            <ScheduleTimePicker
              idPrefix={`${idBase}-entry1`}
              value={day.entry1}
              onChange={(value) => setTime("entry1", value)}
              onClear={() => setTime("entry1", "")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("admin.schedule.exitOptional")}</Label>
            <ScheduleTimePicker
              idPrefix={`${idBase}-exit1`}
              value={day.exit1}
              onChange={(value) => setTime("exit1", value)}
              onClear={() => setTime("exit1", "")}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t("admin.schedule.slot1")}</p>
            <div className={compact ? "space-y-3" : "grid gap-4 sm:grid-cols-2"}>
              <div className="space-y-2">
                <Label className="text-xs">{t("admin.schedule.entry")}</Label>
                <ScheduleTimePicker
                  idPrefix={`${idBase}-entry1`}
                  value={day.entry1}
                  onChange={(value) => setTime("entry1", value)}
                  onClear={() => setTime("entry1", "")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("admin.schedule.exitOptional")}</Label>
                <ScheduleTimePicker
                  idPrefix={`${idBase}-exit1`}
                  value={day.exit1}
                  onChange={(value) => setTime("exit1", value)}
                  onClear={() => setTime("exit1", "")}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t("admin.schedule.slot2")}</p>
            <div className={compact ? "space-y-3" : "grid gap-4 sm:grid-cols-2"}>
              <div className="space-y-2">
                <Label className="text-xs">{t("admin.schedule.entry")}</Label>
                <ScheduleTimePicker
                  idPrefix={`${idBase}-entry2`}
                  value={day.entry2}
                  onChange={(value) => setTime("entry2", value)}
                  onClear={() => setTime("entry2", "")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("admin.schedule.exitOptional")}</Label>
                <ScheduleTimePicker
                  idPrefix={`${idBase}-exit2`}
                  value={day.exit2}
                  onChange={(value) => setTime("exit2", value)}
                  onClear={() => setTime("exit2", "")}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("admin.schedule.exitHint")}</p>
    </div>
  );
}

export default function EmployeeWeekScheduleEditor({
  schedule,
  onChange,
  scheduleDays,
  layout = "form",
}: EmployeeWeekScheduleEditorProps) {
  const [modeByDay, setModeByDay] = useState<Partial<Record<WeekdayKey, ScheduleDayMode>>>(() => {
    const initial: Partial<Record<WeekdayKey, ScheduleDayMode>> = {};
    for (const day of scheduleDays) {
      initial[day.key] = getScheduleDayMode(schedule[day.key]);
    }
    return initial;
  });

  const containerClass =
    layout === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-1 gap-4";

  const updateDay = (dayKey: WeekdayKey, day: DaySchedule) => {
    onChange({ ...schedule, [dayKey]: day });
    if (getScheduleDayMode(day) === "split") {
      setModeByDay((prev) => ({ ...prev, [dayKey]: "split" }));
    }
  };

  const setModeForDay = (dayKey: WeekdayKey, mode: ScheduleDayMode) => {
    setModeByDay((prev) => ({ ...prev, [dayKey]: mode }));
  };

  return (
    <div className={containerClass}>
      {scheduleDays.map((day) => (
        <ScheduleDayEditor
          key={day.key}
          dayKey={day.key}
          dayLabel={day.label}
          day={schedule[day.key]}
          mode={modeByDay[day.key] ?? getScheduleDayMode(schedule[day.key])}
          onDayChange={(nextDay) => updateDay(day.key, nextDay)}
          onModeChange={(mode) => setModeForDay(day.key, mode)}
          compact={layout === "grid"}
        />
      ))}
    </div>
  );
}
