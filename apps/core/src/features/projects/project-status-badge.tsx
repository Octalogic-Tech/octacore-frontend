import { Badge } from '@/components/ui/badge';
import { PROJECT_STATUS_LABELS, type ProjectStatus } from './schema';

/** Active is a solid block; On hold and Completed are outlined. The word carries the meaning, not the colour. */
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={status === 'active' ? 'solid' : 'outline'}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}
