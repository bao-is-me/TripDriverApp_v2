import { TripDriverProvider } from '../state/TripDriverContext'
import { AppShell } from '../ui/AppShell'

export function TripDriverApp() {
  return (
    <TripDriverProvider>
      <AppShell />
    </TripDriverProvider>
  )
}
