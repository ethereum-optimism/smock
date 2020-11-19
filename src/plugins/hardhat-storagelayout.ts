import { subtask } from 'hardhat/config'
import { TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOB_FOR_FILE } from 'hardhat/builtin-tasks/task-names'
import { TASK_COMPILE_SOLIDITY_GET_ARTIFACT_FROM_COMPILATION_OUTPUT } from 'hardhat/builtin-tasks/task-names'

subtask(
  TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOB_FOR_FILE,
  async (_, __, runSuper) => {
    const compilationJob = await runSuper()
    compilationJob.solidityConfig.settings.outputSelection['*']['*'].push(
      'storageLayout'
    )
    return compilationJob
  }
)

subtask(
  TASK_COMPILE_SOLIDITY_GET_ARTIFACT_FROM_COMPILATION_OUTPUT,
  async ({ contractOutput }: { contractOutput: any }, __, runSuper) => {
    const artifact = await runSuper()
    artifact.storageLayout = contractOutput.storageLayout
    return artifact
  }
)
