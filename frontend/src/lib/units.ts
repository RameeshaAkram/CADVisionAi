export const unitOptions = [
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'inches', label: 'in' },
  { value: 'feet', label: 'ft' },
];

export const formatUnit = (unitVal: string) => {
  const map: Record<string, string> = {
    'mm': 'mm',
    'cm': 'cm',
    'inches': 'in',
    'feet': 'ft'
  };
  return map[unitVal] || unitVal;
};
