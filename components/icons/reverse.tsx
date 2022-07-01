import React from 'react';
import type { BoxProps } from '@nelson-ui/react';
import { Box } from '@nelson-ui/react';

export const ReverseIcon: React.FC<BoxProps> = props => {
  return (
    <Box height="36px" width="36px" {...props}>
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="18" cy="18" r="18" transform="rotate(90 18 18)" fill="#666666" />
        <path
          d="M22.4283 24.6631C21.7889 24.6631 21.3191 24.2325 21.3191 23.593L21.3191 16.2199L21.4626 14.1319L20.249 15.6327L19.5965 16.3504C19.4268 16.5592 19.1658 16.6636 18.8527 16.6636C18.2654 16.6636 17.8478 16.2199 17.8478 15.6327C17.8478 15.3456 17.9392 15.0976 18.1349 14.8888L21.5018 11.4045C21.7758 11.1174 22.089 11 22.4283 11C22.7545 11 23.0416 11.1174 23.3157 11.4045L26.6956 14.8888C26.8913 15.0976 26.9827 15.3456 26.9827 15.6327C26.9827 16.2199 26.5651 16.6636 25.9778 16.6636C25.6646 16.6636 25.4167 16.5592 25.2209 16.3504L24.5685 15.6327L23.394 14.145L23.5245 16.2199L23.5245 23.593C23.5245 24.2325 23.0677 24.6631 22.4283 24.6631ZM13.5675 24.6631C13.2412 24.6631 12.9541 24.5457 12.6801 24.2716L9.30021 20.7743C9.10446 20.5655 9.00007 20.3175 9.00007 20.0304C9.00007 19.4432 9.43071 18.9995 10.0179 18.9995C10.3181 18.9995 10.5791 19.117 10.7618 19.3127L11.4273 20.0304L12.6018 21.5312L12.4713 19.4432L12.4713 12.0701C12.4713 11.4306 12.9281 11 13.5675 11C14.2069 11 14.6767 11.4306 14.6767 12.0701L14.6767 19.4432L14.5332 21.5312L15.7468 20.0304L16.3993 19.3127C16.5559 19.117 16.8299 18.9995 17.1431 18.9995C17.7304 18.9995 18.148 19.4432 18.148 20.0304C18.148 20.3175 18.0566 20.5655 17.8478 20.7743L14.494 24.2716C14.22 24.5457 13.9068 24.6631 13.5675 24.6631Z"
          fill="#0C0C0D"
        />
      </svg>
    </Box>
  );
};
