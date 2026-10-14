import type {ReactNode} from 'react';
import {Icon,type IconName} from './Icon';

/** A friendly empty state: a drawing, one line saying what is missing, one saying what to do, and optionally the button that does it. */
export function Empty({icon,title,children,action}:{icon:IconName;title:string;children?:ReactNode;action?:ReactNode}){
  return <div className="empty"><span className="empty-art" aria-hidden="true"><Icon name={icon} size={30}/></span><strong>{title}</strong>{children&&<p className="muted">{children}</p>}{action&&<div className="actions">{action}</div>}</div>;
}
