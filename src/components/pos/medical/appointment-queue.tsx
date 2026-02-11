'use client';

import { Badge } from '@/components/ui/badge';

interface Appointment {
  id: string;
  patientName: string;
  time: string;
  status: 'waiting' | 'in_progress' | 'completed';
}

interface AppointmentQueueProps {
  appointments?: Appointment[];
}

const defaultAppointments: Appointment[] = [
  { id: '1', patientName: '王先生', time: '09:00', status: 'completed' },
  { id: '2', patientName: '李小姐', time: '09:30', status: 'in_progress' },
  { id: '3', patientName: '陳先生', time: '10:00', status: 'waiting' },
  { id: '4', patientName: '張小姐', time: '10:30', status: 'waiting' },
];

const statusLabels = {
  waiting: '候診中',
  in_progress: '診療中',
  completed: '已完成',
};

export function AppointmentQueue({ appointments = defaultAppointments }: AppointmentQueueProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">候診列表</p>
      <div className="space-y-2">
        {appointments.map((apt) => (
          <div
            key={apt.id}
            className="flex items-center justify-between rounded-md border p-2 text-sm"
          >
            <div>
              <span className="font-medium">{apt.patientName}</span>
              <span className="ml-2 text-neutral-500">{apt.time}</span>
            </div>
            <Badge
              variant={
                apt.status === 'in_progress'
                  ? 'default'
                  : apt.status === 'completed'
                    ? 'secondary'
                    : 'outline'
              }
            >
              {statusLabels[apt.status]}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
