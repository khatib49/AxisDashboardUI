import { useState } from "react";
import Select from "../Select";
import Input from "../input/InputField";

interface CountryCode {
  code: string;
  label: string;
}

interface PhoneInputProps {
  countries: CountryCode[];
  placeholder?: string;
  onChange?: (phoneNumber: string) => void;
  selectPosition?: "start" | "end"; // New prop for dropdown position
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  countries,
  placeholder = "+1 (555) 000-0000",
  onChange,
  selectPosition = "start", // Default position is 'start'
}) => {
  const [selectedCountry, setSelectedCountry] = useState<string>("US");
  const [phoneNumber, setPhoneNumber] = useState<string>("+1");

  const countryCodes: Record<string, string> = countries.reduce(
    (acc, { code, label }) => ({ ...acc, [code]: label }),
    {}
  );

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value;
    setSelectedCountry(newCountry);
    setPhoneNumber(countryCodes[newCountry]);
    if (onChange) {
      onChange(countryCodes[newCountry]);
    }
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPhoneNumber = e.target.value;
    setPhoneNumber(newPhoneNumber);
    if (onChange) {
      onChange(newPhoneNumber);
    }
  };

  return (
    <div className="relative flex">
      {/* Dropdown position: Start */}
      {selectPosition === "start" && (
        <div className="absolute">
          <Select
            options={countries.map((c) => ({ value: c.code, label: c.code }))}
            defaultValue={selectedCountry}
            onChange={(v: string | number) => handleCountryChange({ target: { value: String(v) } } as unknown as React.ChangeEvent<HTMLSelectElement>)}
            className="w-28"
          />
        </div>
      )}

      {/* Input field */}
      <Input
        type="tel"
        value={phoneNumber}
        onChange={(e) => handlePhoneNumberChange(e as unknown as React.ChangeEvent<HTMLInputElement>)}
        placeholder={placeholder}
        className={`${selectPosition === "start" ? "pl-[84px]" : "pr-[84px]"}`}
      />

      {/* Dropdown position: End */}
      {selectPosition === "end" && (
        <div className="absolute right-0">
          <Select
            options={countries.map((c) => ({ value: c.code, label: c.code }))}
            defaultValue={selectedCountry}
            onChange={(v: string | number) => handleCountryChange({ target: { value: String(v) } } as unknown as React.ChangeEvent<HTMLSelectElement>)}
            className="w-28"
          />
        </div>
      )}
    </div>
  );
};

export default PhoneInput;
