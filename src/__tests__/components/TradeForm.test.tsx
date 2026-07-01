import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TradeForm } from '@/app/dashboard/components/TradeForm'
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

describe('TradeForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('Rendering', () => {
    it('should render form with all input fields', () => {
      render(<TradeForm />)

      expect(screen.getByLabelText(/entry price/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/exit price/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/upload image/i)).toBeInTheDocument()
    })

    it('should display form title', () => {
      render(<TradeForm />)
      expect(screen.getByText(/trade form/i)).toBeInTheDocument()
    })

    it('should have submit button', () => {
      render(<TradeForm />)
      expect(screen.getByRole('button', { name: /submit|save/i })).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should validate required fields on submit', async () => {
      const user = userEvent.setup()
      render(<TradeForm />)

      const submitButton = screen.getByRole('button', { name: /submit|save/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/field is required|required/i)).toBeInTheDocument()
      })
    })

    it('should validate entry price is positive', async () => {
      const user = userEvent.setup()
      render(<TradeForm />)

      const entryPriceInput = screen.getByLabelText(/entry price/i)
      await user.type(entryPriceInput, '-100')

      expect(screen.getByText(/must be positive|greater than/i)).toBeInTheDocument()
    })

    it('should validate quantity is positive', async () => {
      const user = userEvent.setup()
      render(<TradeForm />)

      const quantityInput = screen.getByLabelText(/quantity/i)
      await user.type(quantityInput, '0')

      expect(screen.getByText(/must be greater than zero|positive/i)).toBeInTheDocument()
    })
  })

  describe('Image Upload', () => {
    it('should accept image files', async () => {
      const user = userEvent.setup()
      render(<TradeForm />)

      const fileInput = screen.getByLabelText(/upload image/i)
      const file = new File(['image data'], 'trade.jpg', { type: 'image/jpeg' })

      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByAltText(/trade image|preview/i)).toBeInTheDocument()
      })
    })

    it('should reject files larger than 10MB', async () => {
      const user = userEvent.setup()
      render(<TradeForm />)

      const fileInput = screen.getByLabelText(/upload image/i)
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      })

      await user.upload(fileInput, largeFile)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('too large'))
      })
    })

    it('should reject non-image files', async () => {
      const user = userEvent.setup()
      render(<TradeForm />)

      const fileInput = screen.getByLabelText(/upload image/i)
      const textFile = new File(['text content'], 'file.txt', { type: 'text/plain' })

      await user.upload(fileInput, textFile)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Invalid'))
      })
    })

    it('should display loading state during upload', async () => {
      const user = userEvent.setup()
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true, json: () => ({ success: true, url: '/uploads/test.jpg' }) }), 100))
      )

      render(<TradeForm />)

      const fileInput = screen.getByLabelText(/upload image/i)
      const file = new File(['image'], 'trade.jpg', { type: 'image/jpeg' })

      await user.upload(fileInput, file)

      expect(screen.getByText(/uploading|loading/i)).toBeInTheDocument()
    })

    it('should show remove button on hover after image upload', async () => {
      const user = userEvent.setup()
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, url: '/uploads/test.jpg' }),
      })

      render(<TradeForm />)

      const fileInput = screen.getByLabelText(/upload image/i)
      const file = new File(['image'], 'trade.jpg', { type: 'image/jpeg' })

      await user.upload(fileInput, file)

      await waitFor(() => {
        const preview = screen.getByAltText(/trade image|preview/i)
        expect(preview).toBeInTheDocument()
      })

      // Hover over preview
      const imageContainer = screen.getByAltText(/trade image|preview/i).parentElement
      fireEvent.mouseEnter(imageContainer!)

      // Remove button should be visible
      expect(screen.getByRole('button', { name: /remove|delete/i })).toBeVisible()
    })

    it('should remove image when delete button clicked', async () => {
      const user = userEvent.setup()
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, url: '/uploads/test.jpg' }),
      })

      render(<TradeForm />)

      const fileInput = screen.getByLabelText(/upload image/i)
      const file = new File(['image'], 'trade.jpg', { type: 'image/jpeg' })

      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByAltText(/trade image|preview/i)).toBeInTheDocument()
      })

      // Hover and remove
      const imageContainer = screen.getByAltText(/trade image|preview/i).parentElement
      fireEvent.mouseEnter(imageContainer!)

      const removeButton = screen.getByRole('button', { name: /remove|delete/i })
      await user.click(removeButton)

      expect(screen.queryByAltText(/trade image|preview/i)).not.toBeInTheDocument()
    })

    it('should call API with correct file on upload', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true, url: '/uploads/test.jpg' }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      render(<TradeForm />)

      const fileInput = screen.getByLabelText(/upload image/i)
      const file = new File(['image'], 'trade.jpg', { type: 'image/jpeg' })

      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/trade-upload', expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        }))
      })
    })
  })

  describe('Form Submission', () => {
    it('should submit form with valid data', async () => {
      const user = userEvent.setup()
      const onSubmit = jest.fn()

      render(<TradeForm onSubmit={onSubmit} />)

      await user.type(screen.getByLabelText(/entry price/i), '100')
      await user.type(screen.getByLabelText(/exit price/i), '110')
      await user.type(screen.getByLabelText(/quantity/i), '10')

      await user.click(screen.getByRole('button', { name: /submit|save/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled()
      })
    })

    it('should show success toast on successful submission', async () => {
      const user = userEvent.setup()
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      render(<TradeForm />)

      await user.type(screen.getByLabelText(/entry price/i), '100')
      await user.type(screen.getByLabelText(/exit price/i), '110')
      await user.type(screen.getByLabelText(/quantity/i), '10')

      await user.click(screen.getByRole('button', { name: /submit|save/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled()
      })
    })

    it('should show error toast on failed submission', async () => {
      const user = userEvent.setup()
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<TradeForm />)

      await user.type(screen.getByLabelText(/entry price/i), '100')
      await user.type(screen.getByLabelText(/exit price/i), '110')
      await user.type(screen.getByLabelText(/quantity/i), '10')

      await user.click(screen.getByRole('button', { name: /submit|save/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
    })

    it('should disable submit button during submission', async () => {
      const user = userEvent.setup()
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true, json: () => ({ success: true }) }), 100))
      )

      render(<TradeForm />)

      await user.type(screen.getByLabelText(/entry price/i), '100')
      await user.type(screen.getByLabelText(/exit price/i), '110')
      await user.type(screen.getByLabelText(/quantity/i), '10')

      const submitButton = screen.getByRole('button', { name: /submit|save/i })
      await user.click(submitButton)

      expect(submitButton).toBeDisabled()
    })
  })

  describe('PnL Calculation', () => {
    it('should display calculated profit and loss', async () => {
      const user = userEvent.setup()
      render(<TradeForm />)

      await user.type(screen.getByLabelText(/entry price/i), '100')
      await user.type(screen.getByLabelText(/exit price/i), '110')
      await user.type(screen.getByLabelText(/quantity/i), '10')

      // PnL should be displayed or calculated
      await waitFor(() => {
        const pnlText = screen.queryByText(/100|profit|loss/i)
        expect(pnlText).toBeInTheDocument()
      })
    })

    it('should update PnL on price changes', async () => {
      const user = userEvent.setup()
      render(<TradeForm showCalculations={true} />)

      const entryInput = screen.getByLabelText(/entry price/i)
      const exitInput = screen.getByLabelText(/exit price/i)
      const quantityInput = screen.getByLabelText(/quantity/i)

      await user.type(entryInput, '100')
      await user.type(exitInput, '110')
      await user.type(quantityInput, '10')

      await waitFor(() => {
        expect(screen.getByText(/100|PnL/i)).toBeInTheDocument()
      })

      // Change exit price
      await user.clear(exitInput)
      await user.type(exitInput, '120')

      await waitFor(() => {
        expect(screen.getByText(/200|PnL/i)).toBeInTheDocument()
      })
    })
  })
})
