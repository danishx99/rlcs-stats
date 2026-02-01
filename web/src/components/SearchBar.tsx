import { useEffect, useState } from "react";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputType?: string;
};

export default function SearchBar({
  value,
  onChange,
  placeholder,
  inputType = "search"
}: SearchBarProps) {
  const [internal, setInternal] = useState(value);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  return (
    <div className="search-input">
      <input
        type={inputType}
        placeholder={placeholder}
        value={internal}
        onChange={(event) => {
          const nextValue = event.target.value;
          setInternal(nextValue);
          onChange(nextValue);
        }}
      />
    </div>
  );
}
