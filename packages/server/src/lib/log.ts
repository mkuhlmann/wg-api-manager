import { Logger } from '@thanhhoajs/logger';

export const createLog = (name: string) => {
	return Logger.get(name);
};
