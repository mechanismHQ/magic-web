import { useTx } from '../use-tx';

export const useRegisterSwapper = () => {
  return useTx(
    (_contracts, _submit) => {
      throw new Error('Remove `useRegisterSwapper` usage');
      // const tx = contracts.bridge.initializeSwapper();
      // return submit(tx);
      // return tx.submit({});
      // return tx.submit({
      //   sponsored: true,
      // });
    },
    {}
    // { sponsored: true }
  );
};
