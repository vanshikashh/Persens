import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import Landing    from '@/pages/Landing'
import Retrieve   from '@/pages/Retrieve'
import Edit       from '@/pages/Edit'
import Authenticate from '@/pages/Authenticate'
import Compose    from '@/pages/Compose'
import Explain    from '@/pages/Explain'
import History    from '@/pages/History'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/"            element={<Landing />} />
        <Route path="/retrieve"    element={<Retrieve />} />
        <Route path="/edit"        element={<Edit />} />
        <Route path="/authenticate" element={<Authenticate />} />
        <Route path="/compose"     element={<Compose />} />
        <Route path="/explain"     element={<Explain />} />
        <Route path="/history"     element={<History />} />
      </Route>
    </Routes>
  )
}
