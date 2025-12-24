# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e7]
    - generic [ref=e9]: Ticketrack
  - generic [ref=e10]:
    - generic [ref=e11]:
      - heading "Welcome Back" [level=3] [ref=e12]
      - paragraph [ref=e13]: Sign in to access your tickets and more
    - generic [ref=e14]:
      - generic [ref=e15]:
        - generic [ref=e16]:
          - text: Email Address
          - generic [ref=e17]:
            - img [ref=e18]
            - textbox "Email Address" [ref=e21]:
              - /placeholder: Enter your email
        - generic [ref=e22]:
          - text: Password
          - generic [ref=e23]:
            - img [ref=e24]
            - textbox "Password" [ref=e27]:
              - /placeholder: Enter your password
            - button [ref=e28] [cursor=pointer]:
              - img [ref=e29]
        - button "Forgot Password?" [ref=e33] [cursor=pointer]
        - button "Sign In" [ref=e34] [cursor=pointer]
      - paragraph [ref=e36]:
        - text: Don't have an account?
        - button "Sign Up" [ref=e37] [cursor=pointer]
  - paragraph [ref=e38]:
    - text: By continuing, you agree to our
    - link "Terms of Service" [ref=e39] [cursor=pointer]:
      - /url: /terms
    - text: and
    - link "Privacy Policy" [ref=e40] [cursor=pointer]:
      - /url: /privacy
```