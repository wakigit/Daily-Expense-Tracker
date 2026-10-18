export default function DateSearchNotice({parsed,ym,onChangeMonth}) {
  if(parsed?.kind==='invalid')return <p className="search-notice" role="status">{parsed.message}</p>;
  if(parsed?.kind==='date'&&parsed.date.slice(0,7)!==ym)return <p className="search-notice" role="status">{parsed.date} is outside the selected month. <button type="button" className="chip-option" onClick={()=>onChangeMonth?.(parsed.date.slice(0,7))}>Show {parsed.date.slice(0,7)}</button></p>;
  return null;
}
