import React, { useMemo } from 'react';
import { Schedule } from '../types';
import EditableCell from './EditableCell';
import DateCell from './DateCell';
import ProgressBar from './ProgressBar';
import { calculateEndDate, formatDateForDisplay } from '../utils/dateCalculations';

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

  // パステルカラーのパレット（隣り合う色が異なる色味になるよう配置）
  const pastelColors = [
    'bg-pink-100',      // ピンク
    'bg-sky-100',       // スカイブルー
    'bg-amber-100',     // アンバー
    'bg-purple-100',    // パープル
    'bg-lime-100',      // ライム
    'bg-rose-100',      // ローズ
    'bg-cyan-100',      // シアン
    'bg-orange-100',    // オレンジ
    'bg-indigo-100',    // インディゴ
    'bg-yellow-100',    // イエロー
    'bg-teal-100',      // ティール
    'bg-fuchsia-100',   // フクシア
  ];

  const getCategoryColor = (index: number) => {
    return pastelColors[index % pastelColors.length];
  };

  const getDisplayEndDate = (startDate: string | undefined, duration: number | undefined, savedEndDate: string | undefined) => {
    // まずクライアント側で計算
    const calculated = calculateEndDate(startDate, duration);
    if (calculated) return formatDateForDisplay(calculated);
    // 計算できない場合は保存された値を使用
    return formatDateForDisplay(savedEndDate);
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
            <th rowSpan={2} className="border border-gray-300 px-4 py-2 text-left">大項目</th>
            <th rowSpan={2} className="border border-gray-300 px-4 py-2 text-left">項目</th>
            <th colSpan={3} className="border border-gray-300 px-4 py-2 text-center bg-blue-50">予定</th>
            <th colSpan={3} className="border border-gray-300 px-4 py-2 text-center bg-green-50">実績</th>
            <th rowSpan={2} className="border border-gray-300 px-4 py-2 text-center w-32">進捗</th>
          </tr>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2 text-center w-32 bg-blue-50">開始日</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-20 bg-blue-50">日数</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-24 bg-blue-50">終了日</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-32 bg-green-50">開始日</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-20 bg-green-50">日数</th>
            <th className="border border-gray-300 px-4 py-2 text-center w-24 bg-green-50">終了日</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedSchedules).map(([category, categorySchedules], categoryIndex) => (
            <React.Fragment key={`fragment-${category}-${categoryIndex}`}>
              <tr className={getCategoryColor(categoryIndex)}>
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
                    placeholder="担当者名を入力"
                  />
                </td>
                <td className="border border-gray-300 px-4 py-2" colSpan={6}></td>
                <td className="border border-gray-300 px-4 py-2">
                  <ProgressBar progress={calculateCategoryProgress(categorySchedules)} />
                </td>
              </tr>
              {categorySchedules.map((schedule, scheduleIndex) => (
                <tr key={`${category}-${schedule.id}-${scheduleIndex}`} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2">{schedule.item}</td>
                  <td className="border border-gray-300 px-2 py-1">
                    <DateCell
                      value={schedule.start_date}
                      onChange={(value) => onUpdateSchedule({ id: schedule.id, start_date: value || undefined })}
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <EditableCell
                      value={schedule.duration}
                      onChange={(value) => onUpdateSchedule({ id: schedule.id, duration: value ? Number(value) : undefined })}
                      type="number"
                      placeholder="日数"
                      min={1}
                    />
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">
                    {getDisplayEndDate(schedule.start_date, schedule.duration, schedule.end_date)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <DateCell
                      value={schedule.actual_start}
                      onChange={(value) => onUpdateSchedule({ id: schedule.id, actual_start: value || undefined })}
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <EditableCell
                      value={schedule.actual_duration}
                      onChange={(value) => onUpdateSchedule({ id: schedule.id, actual_duration: value ? Number(value) : undefined })}
                      type="number"
                      placeholder=""
                      min={1}
                    />
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">
                    {getDisplayEndDate(schedule.actual_start, schedule.actual_duration, schedule.actual_end)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <div className="flex items-center gap-1">
                      <div className="flex items-center">
                        <div className="w-12">
                          <EditableCell
                            value={schedule.progress}
                            onChange={(value) => {
                              if (value === undefined) {
                                onUpdateSchedule({ id: schedule.id, progress: null });
                              } else {
                                const num = value as number;
                                const rounded = Math.round(num / 5) * 5;
                                const clamped = Math.max(0, Math.min(100, rounded));
                                onUpdateSchedule({ id: schedule.id, progress: clamped });
                              }
                            }}
                            type="number"
                            placeholder="0"
                            step={5}
                            min={0}
                            max={100}
                          />
                        </div>
                        <span className="text-sm ml-0.5">%</span>
                      </div>
                      <div className="flex-1">
                        <ProgressBar progress={schedule.progress || 0} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ScheduleTable;