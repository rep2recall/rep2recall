package rep2recall.api

data class CreateResponse(
        val id: String
)

data class StdSuccessResponse(
        val result: String
)

data class StdErrorResponse(
        val error: String
)