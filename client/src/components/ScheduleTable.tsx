import { useMemo } from 'react';
import { Schedule } from '../types';
import EditableCell from './EditableCell';
import DateCell from './DateCell';
import ProgressBar from './ProgressBar';
import { calculateEndDate, calculateProgress, formatDateForDisplay } from '../utils/dateCalculations';

interface ScheduleTableProps {
  schedules: Schedule[];
  onUpdateSchedule: (schedule: Partial<Schedule>) => void;
}

function ScheduleTable({ schedules, onUpdateSchedule }: ScheduleTableProps) {
  const groupedSchedules = useMemo(() => {
    const groups: { [key: string]: Schedule[] } = {};
    schedules.forEach((schedule) => {
      if (!groups[schedule.category]) {
        groups[schedule.category] = [];
      }
      groups[schedule.category].push(schedule);
    });
    return groups;
  }, [schedules]);

  const getDisplayEndDate = (startDate: string | undefined, duration: number | undefined, savedEndDate: string | undefined) => {
    // まずクライアント側で計算
    const calculated = calculateEndDate(startDate, duration);
    if (calculated) return formatDateForDisplay(calculated);
    // 計算できない場合は保存された値を使用
    return formatDateForDisplay(savedEndDate);
  };
  
  const getDisplayProgress = (startDate: string | undefined, duration: number | undefined, savedProgress: number | undefined) => {
    // まずクライアント側で計算
    const calculated = calculateProgress(startDate, duration);
    if (startDate && duration) return calculated;
    // 計算できない場合は保存された値を使用
    return savedProgress || 0;
  };

  const calculateCategoryProgress = (categorySchedules: Schedule[]) => {
    const validSchedules = categorySchedules.filter(s => s.progress !== undefined);
    if (validSchedules.length === 0) return 0;
    const totalProgress = validSchedules.reduce((sum, s) => sum + (s.progress || 0), 0);
    return Math.round(totalProgress / validSchedules.length);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2 text-left">大項目</th>
            <th className="border border-gray-300 px-4 py-2 text-left">項目</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-32">予定<br/>開始日</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-20">日数</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-24">終了日</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-20">終了</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-32">実績<br/>開始日</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-20">日数</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-24">終了日</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-20">終了</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-32">進捗</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedSchedules).map(([category, categorySchedules]) => (
            <>
              <tr key={`category-${category}`} className="bg-blue-50">
                <td className="border border-gray-300 px-4 py-2 font-semibold" rowSpan={categorySchedules.length + 1}>
                  {category}
                </td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">
                  <EditableCell
                    value={categorySchedules[0]?.owner}
                    onChange={(value) => {
                      categorySchedules.forEach(schedule => {
                        onUpdateSchedule({ id: schedule.id, owner: value as string });
                      });
                    }}
                    placeholder="担当者"
                  />
                </td>
                <td className="border border-gray-300 px-4 py-2" colSpan={8}></td>
                <td className="border border-gray-300 px-4 py-2">
                  <ProgressBar progress={calculateCategoryProgress(categorySchedules)} />
                </td>
              </tr>
              {categorySchedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2">{schedule.item}</td>
                  <td className="border border-gray-300 px-2 py-1">
                    <DateCell
                      value={schedule.start_date}
                      onChange={(value) => onUpdateSchedule({ id: schedule.id, start_date: value })}
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <EditableCell
                      value={schedule.duration}
                      onChange={(value) => onUpdateSchedule({ id: schedule.id, duration: value as number })}
                      type="number"
                      placeholder="日数"
                    />
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">
                    {getDisplayEndDate(schedule.start_date, schedule.duration, schedule.end_date)}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">
                    {formatDateForDisplay(schedule.end_date)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <DateCell
                      value={schedule.actual_start}
                      onChange={(value) => onUpdateSchedule({ id: schedule.id, actual_start: value })}
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <EditableCell
                      value={schedule.actual_duration}
                      onChange={(value) => onUpdateSchedule({ id: schedule.id, actual_duration: value as number })}
                      type="number"
                      placeholder=""
                    />
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">
                    {getDisplayEndDate(schedule.actual_start, schedule.actual_duration, schedule.actual_end)}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">
                    {formatDateForDisplay(schedule.actual_end)}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <ProgressBar progress={getDisplayProgress(schedule.start_date, schedule.duration, schedule.progress)} />
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ScheduleTable;