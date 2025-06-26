import { v4 as uuidV4 } from 'uuid';
import { IExec } from 'iexec';

export async function pushRequesterSecret({
  iexec,
  value,
}: {
  iexec: IExec;
  value: string;
}) {
  const secretName = uuidV4();
  await iexec.secrets.pushRequesterSecret(secretName, value);
  return secretName;
}
