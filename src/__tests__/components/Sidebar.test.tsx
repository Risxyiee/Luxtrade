import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '@/app/dashboard/components/Sidebar'
import { toast } from 'sonner'

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock fetch
global.fetch = jest.fn()

describe('Sidebar Component - Delete Account', () => {
  const mockAccounts = [
    { id: '1', name: 'Main Account', currency: 'USD', type: 'LIVE' },
    { id: '2', name: 'Demo Account', currency: 'USD', type: 'DEMO' },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('Rendering', () => {
    it('should render trading accounts list', () => {
      render(<Sidebar accounts={mockAccounts} />)

      expect(screen.getByText('Main Account')).toBeInTheDocument()
      expect(screen.getByText('Demo Account')).toBeInTheDocument()
    })

    it('should display delete icon on account hover', async () => {
      const user = userEvent.setup()
      render(<Sidebar accounts={mockAccounts} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      // Delete button should be visible on hover
      expect(screen.getByRole('button', { name: /delete|trash/i })).toBeVisible()
    })

    it('should hide delete icon when not hovering', () => {
      render(<Sidebar accounts={mockAccounts} />)

      const deleteButtons = screen.queryAllByRole('button', { name: /delete|trash/i })
      
      // Should either not exist or be hidden
      deleteButtons.forEach(btn => {
        expect(btn).not.toBeVisible()
      })
    })

    it('should not show delete button if only 1 account exists', () => {
      const singleAccount = [mockAccounts[0]]
      render(<Sidebar accounts={singleAccount} />)

      const deleteButtons = screen.queryAllByRole('button', { name: /delete|trash/i })
      expect(deleteButtons.length).toBe(0)
    })
  })

  describe('Delete Confirmation Modal', () => {
    it('should show confirmation dialog on delete button click', async () => {
      const user = userEvent.setup()
      render(<Sidebar accounts={mockAccounts} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      const deleteButton = screen.getByRole('button', { name: /delete|trash/i })
      await user.click(deleteButton)

      // Modal should appear with account details
      await waitFor(() => {
        expect(screen.getByText(/confirm deletion|delete account|are you sure/i)).toBeInTheDocument()
        expect(screen.getByText('Demo Account')).toBeInTheDocument()
      })
    })

    it('should show account details in confirmation modal', async () => {
      const user = userEvent.setup()
      render(<Sidebar accounts={mockAccounts} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      await user.click(screen.getByRole('button', { name: /delete|trash/i }))

      await waitFor(() => {
        expect(screen.getByText('Demo Account')).toBeInTheDocument()
        expect(screen.getByText(/USD|currency/i)).toBeInTheDocument()
        expect(screen.getByText(/DEMO|type/i)).toBeInTheDocument()
      })
    })

    it('should show warning message about permanent deletion', async () => {
      const user = userEvent.setup()
      render(<Sidebar accounts={mockAccounts} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      await user.click(screen.getByRole('button', { name: /delete|trash/i }))

      await waitFor(() => {
        expect(screen.getByText(/permanent|cannot be undone|deleted forever/i)).toBeInTheDocument()
      })
    })

    it('should have Cancel and Delete buttons', async () => {
      const user = userEvent.setup()
      render(<Sidebar accounts={mockAccounts} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      await user.click(screen.getByRole('button', { name: /delete|trash/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel|close/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /delete|confirm/i })).toBeInTheDocument()
      })
    })
  })

  describe('Delete Functionality', () => {
    it('should call delete API on confirmation', async () => {
      const user = userEvent.setup()
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      render(<Sidebar accounts={mockAccounts} onAccountDeleted={jest.fn()} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      await user.click(screen.getByRole('button', { name: /delete|trash/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete|confirm/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete|confirm/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/trading-accounts'), expect.objectContaining({
          method: 'DELETE',
        }))
      })
    })

    it('should show loading state during deletion', async () => {
      const user = userEvent.setup()
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true, json: () => ({ success: true }) }), 100))
      )

      render(<Sidebar accounts={mockAccounts} onAccountDeleted={jest.fn()} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      await user.click(screen.getByRole('button', { name: /delete|trash/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete|confirm/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete|confirm/i }))

      expect(screen.getByText(/deleting|loading|menghapus/i)).toBeInTheDocument()
    })

    it('should show success toast on successful deletion', async () => {
      const user = userEvent.setup()
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      const onAccountDeleted = jest.fn()
      render(<Sidebar accounts={mockAccounts} onAccountDeleted={onAccountDeleted} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      await user.click(screen.getByRole('button', { name: /delete|trash/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete|confirm/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete|confirm/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('deleted'))
      })
    })

    it('should show error toast on failed deletion', async () => {
      const user = userEvent.setup()
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Deletion failed'))

      render(<Sidebar accounts={mockAccounts} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      await user.click(screen.getByRole('button', { name: /delete|trash/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete|confirm/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete|confirm/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
    })

    it('should close modal on Cancel button click', async () => {
      const user = userEvent.setup()
      render(<Sidebar accounts={mockAccounts} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      await user.click(screen.getByRole('button', { name: /delete|trash/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel|close/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /cancel|close/i }))

      // Modal should be closed
      expect(screen.queryByText(/confirm deletion|delete account/i)).not.toBeInTheDocument()
    })

    it('should call onAccountDeleted callback after successful deletion', async () => {
      const user = userEvent.setup()
      const onAccountDeleted = jest.fn()

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      render(<Sidebar accounts={mockAccounts} onAccountDeleted={onAccountDeleted} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      await user.click(screen.getByRole('button', { name: /delete|trash/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete|confirm/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete|confirm/i }))

      await waitFor(() => {
        expect(onAccountDeleted).toHaveBeenCalledWith('2')
      })
    })
  })

  describe('API Integration', () => {
    it('should send correct DELETE request with account ID', async () => {
      const user = userEvent.setup()
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      render(<Sidebar accounts={mockAccounts} onAccountDeleted={jest.fn()} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      await user.click(screen.getByRole('button', { name: /delete|trash/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete|confirm/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete|confirm/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/trading-accounts/2'),
          expect.objectContaining({
            method: 'DELETE',
          })
        )
      })
    })

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Account has active trades' }),
      })

      render(<Sidebar accounts={mockAccounts} />)

      const accountCard = screen.getByText('Demo Account').closest('[data-testid="account-item"]')
      await user.hover(accountCard!)

      await user.click(screen.getByRole('button', { name: /delete|trash/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete|confirm/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete|confirm/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
    })
  })
})
