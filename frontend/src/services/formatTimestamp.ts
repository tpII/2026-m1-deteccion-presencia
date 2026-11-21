const dateTime = new Intl.DateTimeFormat('es-AR', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return `${dateTime.format(date)}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}
