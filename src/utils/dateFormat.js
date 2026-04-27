export const formatDateDDMMYYYY = (dateValue) => {
  if (!dateValue) return 'N/A';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
};

export const formatDateTimeDDMMYYYY = (dateValue) => {
  if (!dateValue) return 'N/A';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'N/A';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const rawHours = date.getHours();
  const hours = String(rawHours % 12 || 12).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const amPm = rawHours >= 12 ? 'PM' : 'AM';

  return `${day}-${month}-${year} ${hours}:${minutes} ${amPm}`;
};
