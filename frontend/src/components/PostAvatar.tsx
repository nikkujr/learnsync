import {Icon,type IconName} from './Icon';
import {initials,useLook} from './classes';

/** Who posted it (their initials on the class colour) with a small badge for what it is. Without a name it is only the badge. */
export function PostAvatar({name,kind,offeringId}:{name?:string;kind:IconName;offeringId:string}){
  const color=useLook()(offeringId).color;
  if(!name)return <span className="post-icon" aria-hidden="true"><Icon name={kind} size={20}/></span>;
  return <span className="post-avatar" aria-hidden="true" style={{background:color}}>{initials(name)}<span className="post-kind"><Icon name={kind} size={13}/></span></span>;
}
