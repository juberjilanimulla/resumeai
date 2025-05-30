export async function successResponse(res, message, data = null) {
  res.status(200).json({
    status: 200,
    message,
    error: false,
    data,
  });
}

export async function errorResponse(res, statusCode, message) {
  res.status(statusCode).json({
    status: statusCode,
    message,
    error: true,
    data: null,
  });
}
