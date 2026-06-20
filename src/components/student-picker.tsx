'use client';

interface StudentPickerProps {
  students: { id: string; name: string }[];
  value: string;
  onChange: (studentId: string) => void;
  label?: string;
  required?: boolean;
}

export function StudentPicker({
  students,
  value,
  onChange,
  label = '选择学生',
  required = true,
}: StudentPickerProps) {
  if (students.length === 0) {
    return (
      <p className="text-sm text-[#EF5350] text-center" style={{ fontFamily: "'Patrick Hand', cursive" }}>
        请先创建学生账号
      </p>
    );
  }

  if (students.length === 1) {
    return (
      <div className="sketchy-card p-3 bg-[#F5E6D3]/50 text-center">
        <p className="text-xs text-[#8D6E63]">{label}</p>
        <p className="text-[#5D4037] mt-1" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          🎒 {students[0].name}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-[#5D4037] mb-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
        {label}{required ? '（必选）' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        {students.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`px-3 py-2 rounded-lg border-2 text-sm transition-all ${
              value === s.id
                ? 'bg-[#7CB342]/20 border-[#7CB342] text-[#5D4037]'
                : 'bg-[#FFFDE7] border-[#D7CCC8] text-[#8D6E63]'
            }`}
            onClick={() => onChange(s.id)}
          >
            🎒 {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function getDefaultStudentId(students: { id: string }[]): string {
  return students.length === 1 ? students[0].id : '';
}
