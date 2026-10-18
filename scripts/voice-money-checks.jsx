import { parseUtterance, parseVoiceDraft } from '../src/lib/parseUtterance';
export function voiceMoneyChecks(check) {
  const cats=[{id:'food',label:'Food'},{id:'custom-transport',label:'Public transport'}];
  for(const [speech,amount,description] of [
    ['Lazada One chicken rice, 5 dollars 80 cent','5.80','Lazada One chicken rice'],
    ['Store Twenty Five lunch, five dollars eighty','5.80','Store Twenty Five lunch'],
    ['five dollars eighty at Store Twenty Five','5.80','Store Twenty Five'],
    ['7 Eleven for 6 dollars 50 cents','6.50','7 Eleven'],
    ['6 dollars 50 cents at 7 Eleven','6.50','7 Eleven'],
    ['2 chicken rice total 5 dollars 80 cents','5.80','2 chicken rice'],
    ['two chicken rice for S$5.80','5.80','Two chicken rice'],
    ['$5.80 for Station One meal','5.80','Station One meal'],
    ['Station One meal S$5.80','5.80','Station One meal'],
    ['four fifty for chicken rice','4.50','Chicken rice'],
    ['eighty cents for printing','0.80','Printing'],
    ['5 SGD for Block One lunch','5.00','Block One lunch'],
  ]) {const parsed=parseUtterance(speech,cats);check(`voice money span amount: ${speech}`,parsed.amount,amount);check(`voice original description: ${speech}`,parsed.description,description);}
  for(const speech of ['Lazada One chicken rice 5.80','2 meals 8 or 10','5 dollars or 8 dollars','7 Eleven chicken rice']) {
    check(`voice ambiguous price unresolved: ${speech}`,parseVoiceDraft(speech,cats).amountStatus,'ambiguous');
    check(`voice ambiguous price never guessed: ${speech}`,parseUtterance(speech,cats).amount,undefined);
  }
  const parsed=parseUtterance('Lazada One chicken rice, 5 dollars 80 cents Food yesterday',cats,new Date('2026-10-18T04:00:00Z'));
  check('voice category and yesterday survive money-span parsing',[parsed.amount,parsed.category,parsed.date],['5.80','food','2026-10-17']);
  const old={description:'Existing draft',amount:'9',notes:'Keep these notes',category:'custom-transport',date:'2026-10-16'};
  const merged={...old,...parseUtterance('Lazada One chicken rice, 5 dollars 80 cent',cats)};
  check('voice merge preserves notes and unrelated category/date',[merged.notes,merged.category,merged.date],['Keep these notes','custom-transport','2026-10-16']);
  check('voice parser never supplies notes or saves data',Object.keys(parsed).sort(),['amount','category','date','description']);
  for(const speech of ['Lazada One chicken rice','Studio 54 lunch','two chicken rice']) check(`number in description without money cue is not a price: ${speech}`,parseUtterance(speech,cats).amount,undefined);

}
