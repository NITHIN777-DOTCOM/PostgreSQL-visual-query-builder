import { VisualQueryBuilderPage } from './builder/VisualQueryBuilderPage'
import { ToastProvider } from './builder/ui/toast'

export default function App() {
  return (
    <ToastProvider>
      <VisualQueryBuilderPage />
    </ToastProvider>
  )
}
