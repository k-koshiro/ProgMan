import { useState, useEffect, useRef } from 'react';

interface EditableCellProps {
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  type?: 'text' | 'number';
  placeholder?: string;
}

function EditableCell({ value, onChange, type = 'text', placeholder = '' }: EditableCellProps) {
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
      const numValue = parseInt(localValue as string);
      if (!isNaN(numValue) && numValue > 0) {
        onChange(numValue);
      } else if (localValue === '') {
        // 空文字の場合は何もしない（削除を意図している場合）
        return setIsEditing(false);
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
        onBlur={() => {
          // 値が変更された場合のみ保存
          const currentValue = type === 'number' ? parseInt(localValue as string) : localValue;
          const originalValue = value || (type === 'number' ? 0 : '');
          
          if (currentValue !== originalValue && localValue !== '') {
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