defmodule ProximityWeb.CallChannel do
  use ProximityWeb, :channel

  intercept(["sdp_info"])

  def join("call", payload, socket) do
    {:ok, assign(socket, :member_id, Ecto.UUID.generate)}
  end

  def handle_out("sdp_info", %{body: body, member_id: sender_member_id}, socket) do
    %{"member_id" => target_member_id} = body = Jason.decode!(body)
    if socket.assigns.member_id == target_member_id do
      body = body
      |> Map.put("sender_member_id", sender_member_id)
      |> Jason.encode!
      push(socket, "message", %{body: body})
    end
    {:noreply, socket}
  end

  def handle_in("here", _params, socket) do
    broadcast! socket, "new_member", %{member_id: socket.assigns.member_id}
    {:noreply, socket}
  end

  def handle_in("close_connection", _params, socket) do
    broadcast! socket, "member_left", %{member_id: socket.assigns.member_id}
    {:noreply, socket}
  end

  def handle_in("message", %{"body" => body}, socket) do
    body = body
            |> Jason.decode!()
            |> Map.put("member_id", socket.assigns.member_id)
            |> Jason.encode!
    broadcast! socket, "message", %{body: body}
    {:noreply, socket}
  end

  def handle_in("sdp_info", %{"body" => body}, socket) do
    broadcast! socket, "sdp_info", %{body: body, member_id: socket.assigns.member_id}
    {:noreply, socket}
  end
end
