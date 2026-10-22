// The selected companion belongs to one account. Legacy unscoped selections
// have no reliable owner and are intentionally not assigned to the next login.
import { Auth } from './auth.js';

const key = uid => 'hero_active_kozmo:' + uid;
const ownsSession = uid => !!uid && Auth.getState().uid === uid && Auth.getState().status === 'google';

export function getActiveKozmo(uid = Auth.getState().uid){
  if(!ownsSession(uid)) return null;
  try{
    const value = JSON.parse(localStorage.getItem(key(uid)) || 'null');
    return value && value.ownerUid === uid && typeof value.id === 'string' ? value : null;
  }catch(_){ return null; }
}

export function activateKozmo(uid, id, creature, type = {}){
  if(!ownsSession(uid) || typeof id !== 'string' || !id || !creature || typeof creature !== 'object') return false;
  const source = creature.bonus || type.bonus || {}, bonus = {};
  for(const field of ['xp','score','kaju','all']){
    const amount = source[field];
    if(typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= 1) bonus[field] = amount;
  }
  try{
    localStorage.setItem(key(uid), JSON.stringify({
      ownerUid:uid, id, name:String(creature.name || type.n || type.name || 'Kozmo'),
      power:typeof (creature.power || type.power) === 'string' ? creature.power || type.power : null,
      bonus
    }));
    return true;
  }catch(_){ return false; }
}

// Call only after a successful collection read. Missing or consumed companions
// stop contributing a bonus; a failed read must not erase a valid selection.
export function reconcileActiveKozmo(uid, creatures){
  const active = getActiveKozmo(uid);
  if(!active || !creatures || typeof creatures !== 'object' || Array.isArray(creatures)) return active;
  if(Object.prototype.hasOwnProperty.call(creatures, active.id)) return active;
  try{ localStorage.removeItem(key(uid)); }catch(_){}
  return null;
}
