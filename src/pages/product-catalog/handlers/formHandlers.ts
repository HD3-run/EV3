import { FormData } from '../types/catalog.types';

export function handleInputChange(
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
) {
  const { name, value, type } = e.target;
  setFormData(prev => ({
    ...prev,
    [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
  }));
}

export function copyToClipboard(text: string, onSuccess: () => void) {
  navigator.clipboard.writeText(text).then(() => {
    onSuccess();
  });
}

