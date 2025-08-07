import { useState, useEffect, useRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/datepicker.css';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

// 日本語ロケールを登録
registerLocale('ja', ja);

interface DateCellProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
}

function DateCell({ value, onChange, placeholder = '日付を選択' }: DateCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value ? new Date(value) : null
  );
  const [inputValue, setInputValue] = useState(value || '');
  const datePickerRef = useRef<DatePicker>(null);

  useEffect(() => {
    setSelectedDate(value ? new Date(value) : null);
    setInputValue(value || '');
  }, [value]);

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
    if (date) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      setInputValue(formattedDate);
      onChange(formattedDate);
    } else {
      setInputValue('');
      onChange(undefined);
    }
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // 空文字の場合は削除
    if (value === '') {
      setSelectedDate(null);
      onChange(undefined);
      return;
    }
    
    // yyyy-MM-dd形式の検証
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(value + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
        onChange(value);
      }
    }
  };

  const handleInputBlur = () => {
    // 空文字の場合は削除を確定
    if (inputValue === '') {
      onChange(undefined);
      return;
    }
    
    // 入力値が有効な日付でない場合は元の値に戻す
    if (inputValue && !/^\d{4}-\d{2}-\d{2}$/.test(inputValue)) {
      setInputValue(value || '');
    }
  };

  const handleCalendarClick = () => {
    setIsEditing(true);
    // DatePickerを開く
    setTimeout(() => {
      if (datePickerRef.current) {
        datePickerRef.current.setOpen(true);
      }
    }, 0);
  };

  return (
    <div className="flex items-center gap-1 relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-sm"
        pattern="\d{4}-\d{2}-\d{2}"
        title="日付形式: YYYY-MM-DD"
      />
      
      <button
        onClick={handleCalendarClick}
        type="button"
        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-sm"
        title="カレンダーから選択"
      >
        📅
      </button>

      {isEditing && (
        <div className="absolute top-full left-0 mt-1 z-50">
          <DatePicker
            ref={datePickerRef}
            selected={selectedDate}
            onChange={handleDateChange}
            onClickOutside={() => setIsEditing(false)}
            dateFormat="yyyy/MM/dd"
            locale="ja"
            inline
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            todayButton="今日"
          />
        </div>
      )}
    </div>
  );
}

export default DateCell;