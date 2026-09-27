---
Task ID: 2
Agent: main
Task: Optimize OnboardingModal performance

Work Log:
- Read OnboardingModal.tsx to understand current animation configuration
- Reduced progress bar animation duration from 0.5s to 0.2s
- Simplified icon animation: removed scale (0.8→1), kept only opacity (0→1), reduced duration from 0.3s to 0.15s
- Simplified description animation: removed y-slide (10→0), kept only opacity (0→1), reduced duration from 0.3s to 0.15s, removed delay (0.1s → 0s)
- Added willChange: 'opacity' to icon and description motion elements
- Added willChange: 'width' to progress bar motion element
- Verified all changes preserve component props interface and step navigation logic

Stage Summary:
- All 4 animation optimizations applied successfully
- Total step transition time reduced from ~0.6s (0.3s icon + 0.3s desc with 0.1s delay) to ~0.15s (both animate in parallel at 0.15s)
- Removed expensive scale and y-translate transforms, keeping only lightweight opacity transitions
- Added will-change hints for GPU compositing optimization on all animated elements
- No changes to component API, props interface, or step navigation logic
