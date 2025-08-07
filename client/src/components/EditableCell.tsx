import { useState, useEffect, useRef } from 'react';

interface EditableCellProps {
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
}

function EditableCell({ value, onChange, type = 'text', placeholder = '', step, min, max }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 編集中でない場合のみ、外部からの値の変更を反映
    if (!isEditing) {
      setLocalValue(value || '');
    }
  }, [value, isEditing]);

  const handleSave = () => {
    if (type === 'number') {
      // 空文字の場合は削除（undefinedを送信）
      if (localValue === '' || localValue === null) {
        onChange(undefined as any);
        setIsEditing(false);
        return;
      }
      
      const numValue = parseInt(localValue as string);
      if (!isNaN(numValue)) {
        // マイナス値のチェック
        if (numValue < 0) {
          // マイナス値は許可しない
          setLocalValue(value || '');
          setIsEditing(false);
          return;
        }
        // 最小値のチェック（minが設定されていて、かつ値が入力されている場合のみ適用）
        if (min !== undefined && numValue < min && numValue !== 0) {
          onChange(min);
        } else {
          // 最大値のチェック
          const finalValue = max !== undefined ? Math.min(max, numValue) : numValue;
          onChange(finalValue);
        }
      }
    } else {
      onChange(localValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        step={step}
        min={min}
        max={max}
        onBlur={() => {
          // 空文字の場合は削除を意図している
          if (localValue === '' && value !== undefined) {
            handleSave();
            return;
          }
          
          // 値が変更された場合のみ保存
          const currentValue = type === 'number' && localValue !== '' ? parseInt(localValue as string) : localValue;
          const originalValue = value || '';
          
          if (currentValue !== originalValue) {
            handleSave();
          } else {
            setIsEditing(false);
            setLocalValue(value || '');
          }
        }}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        autoFocus
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="px-2 py-1 cursor-pointer hover:bg-gray-50 rounded min-h-[28px]"
    >
      {value || <span className="text-gray-400">{placeholder}</span>}
    </div>
  );
}

export default EditableCell;