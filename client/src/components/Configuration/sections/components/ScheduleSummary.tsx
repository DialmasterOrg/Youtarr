import React from 'react';
import { Link } from 'react-router-dom';
import { describeSchedule, ScheduleKey } from '../../schedules';

export function ScheduleSummary({ scheduleKey, value }: { scheduleKey: ScheduleKey; value: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-muted-foreground">Schedule: {describeSchedule(value)} (server time)</span>
      <Link className="underline font-medium" to={`/settings/scheduling#${scheduleKey}`}>
        Edit schedule
      </Link>
    </div>
  );
}
